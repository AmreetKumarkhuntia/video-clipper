import { serve } from '@hono/node-server';
import { log } from '@lib/utils/logger.js';
import {
  deleteExpiredSessions,
  initDb,
  reencryptIdentityTokens,
  resolveDatabasePath,
  runMigrations,
  validateEncryptedIdentityTokens,
} from '@lib/services/db/index.js';
import { initTokenCipher } from '@lib/services/encryption/index.js';
import { getConfig, getTokenEncryptionKey } from '@lib/config/index.js';
import { createApp } from './app.js';

/**
 * Backend entry point.
 *
 * This process owns the database — it is the only one that migrates or writes,
 * which is what removes the prototype's two-writer contention on SQLite.
 */
const startupConfig = getConfig();
// Validate the deployment secret before opening or migrating a database.
initTokenCipher(getTokenEncryptionKey());
const databasePath = resolveDatabasePath(startupConfig.LIBRARY_DB_PATH);
initDb(databasePath);
runMigrations();

try {
  validateEncryptedIdentityTokens();
} catch (cause) {
  throw new Error(
    'Stored provider tokens cannot be decrypted with TOKEN_ENCRYPTION_KEY. ' +
      'Restore the matching environment secret from the database backup.',
    { cause },
  );
}

// Rows from before encryption are rewritten once after the key is known-good.
const reencrypted = reencryptIdentityTokens();
if (reencrypted > 0) log.info('auth', 'encrypted stored tokens', 'startup', { rows: reencrypted });

// Expired sessions are invisible to `findValidSession` but still rows; without
// a sweep the table only ever grows. Hourly is plenty for a session table, and
// `unref` keeps the timer from holding the process open on shutdown.
function sweep(): void {
  deleteExpiredSessions();
}
sweep();
setInterval(sweep, 60 * 60 * 1000).unref();

const port = Number(process.env.API_PORT ?? 5051);
const hostname = process.env.API_HOST ?? '0.0.0.0';

serve({ fetch: createApp().fetch, port, hostname }, (info) => {
  log.info('api', 'listening', 'startup', { port: info.port, hostname });
});
