import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import type { ApiRuntime } from '@lib/types/api.js';
import { log } from '@lib/utils/logger.js';
import {
  assertMigrationsCurrent,
  closeDb,
  deleteExpiredSessions,
  initDb,
  pingDb,
  reencryptIdentityTokens,
  validateEncryptedIdentityTokens,
} from '@lib/services/db/index.js';
import { initTokenCipher } from '@lib/services/encryption/index.js';
import { getConfig, getDatabaseConfig, getTokenEncryptionKey } from '@lib/config/index.js';
import { createApp } from './app.js';

/**
 * Backend entry point.
 *
 * This process owns live database access. Migrations remain an explicit
 * deployment step; startup only verifies that PostgreSQL is reachable and
 * already at the expected migration revision.
 */
export async function startApi(): Promise<ApiRuntime> {
  try {
    // Validate the full application configuration before opening resources.
    getConfig();
    initTokenCipher(getTokenEncryptionKey());
    initDb(getDatabaseConfig());
    await pingDb();
    await assertMigrationsCurrent();

    try {
      await validateEncryptedIdentityTokens();
    } catch (cause) {
      if (
        !(cause instanceof Error) ||
        !cause.message.startsWith('Encrypted provider token on identity ')
      ) {
        throw cause;
      }
      throw new Error(
        'Stored provider tokens cannot be decrypted with TOKEN_ENCRYPTION_KEY. ' +
          'Restore the matching environment secret from the database backup.',
        { cause },
      );
    }

    // Rows from before encryption are rewritten once after the key is known-good.
    const reencrypted = await reencryptIdentityTokens();
    if (reencrypted > 0) {
      log.info('auth', 'encrypted stored tokens', 'startup', { rows: reencrypted });
    }

    async function sweep(): Promise<void> {
      await deleteExpiredSessions();
    }

    await sweep();
    const port = Number(process.env.API_PORT ?? 5051);
    const hostname = process.env.API_HOST ?? '0.0.0.0';
    const server = serve({ fetch: createApp().fetch, port, hostname }, (info) => {
      log.info('api', 'listening', 'startup', { port: info.port, hostname });
    });

    const sweepTimer = setInterval(
      () => {
        void sweep().catch((error: unknown) => {
          log.warn('auth', 'expired session sweep failed', 'session-sweep', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      },
      60 * 60 * 1000,
    );
    sweepTimer.unref();

    let shutdownPromise: Promise<void> | undefined;
    async function shutdown(signal: string): Promise<void> {
      if (shutdownPromise) return shutdownPromise;

      shutdownPromise = (async (): Promise<void> => {
        clearInterval(sweepTimer);
        log.info('api', 'shutting down', 'shutdown', { signal });

        const failures: unknown[] = [];
        try {
          await new Promise<void>((resolve, reject) => {
            server.close((error?: Error) => {
              if (error) reject(error);
              else resolve();
            });
          });
        } catch (error) {
          failures.push(error);
        }

        try {
          await closeDb();
        } catch (error) {
          failures.push(error);
        }

        if (failures.length === 1) throw failures[0];
        if (failures.length > 1) {
          throw new AggregateError(failures, 'Failed to shut down API resources.');
        }
      })();
      return shutdownPromise;
    }

    return { shutdown };
  } catch (error) {
    try {
      await closeDb();
    } catch (cleanupError) {
      log.error('api', 'startup database cleanup failed', 'startup', {
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
      throw new AggregateError([error, cleanupError], 'API startup and database cleanup failed.');
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const runtime = await startApi();
  process.once('SIGINT', () => {
    void runtime.shutdown('SIGINT').catch((error: unknown) => {
      log.error('api', 'shutdown failed', 'shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    });
  });
  process.once('SIGTERM', () => {
    void runtime.shutdown('SIGTERM').catch((error: unknown) => {
      log.error('api', 'shutdown failed', 'shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    });
  });
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (entryPath === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    log.error('api', 'startup failed', 'startup', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
}
