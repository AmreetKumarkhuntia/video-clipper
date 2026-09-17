import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle, type NodePgDatabase, type NodePgTransaction } from 'drizzle-orm/node-postgres';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { Pool } from 'pg';
import type { DatabaseConfig } from '@lib/types/config.js';
import { log } from '@lib/utils/logger.js';
import * as schema from './schema.js';

let pool: Pool | null = null;
let handle: NodePgDatabase<typeof schema> | null = null;

const transactionContext = new AsyncLocalStorage<
  NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>
>();

function getRootDb(): NodePgDatabase<typeof schema> {
  if (!handle) {
    throw new Error('Database is not initialized. Call initDb(getDatabaseConfig()) first.');
  }
  return handle;
}

/** Creates the process-wide PostgreSQL pool. Connecting remains explicit through pingDb(). */
export function initDb(config: DatabaseConfig): NodePgDatabase<typeof schema> {
  if (pool || handle) {
    throw new Error('Database is already initialized. Call closeDb() before initializing again.');
  }

  const nextPool = new Pool({
    connectionString: config.connectionString,
    max: config.max,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    idleTimeoutMillis: config.idleTimeoutMillis,
  });

  nextPool.on('error', (error: Error): void => {
    log.error('db', 'idle PostgreSQL client error', undefined, { reason: error.message });
  });

  pool = nextPool;
  handle = drizzle(nextPool, { schema });
  return handle;
}

/** Returns the current transaction handle, or the initialized root database outside a transaction. */
export function getDb(): NodePgDatabase<typeof schema> {
  const transaction = transactionContext.getStore();
  return transaction ? (transaction as NodePgDatabase<typeof schema>) : getRootDb();
}

/** Runs existing repository calls atomically without exposing the raw transaction handle. */
export async function withDbTransaction<T>(operation: () => Promise<T>): Promise<T> {
  if (transactionContext.getStore()) {
    return operation();
  }

  return getRootDb().transaction(async (transaction): Promise<T> => {
    return transactionContext.run(transaction, operation);
  });
}

/** Verifies that the configured PostgreSQL server accepts queries. */
export async function pingDb(): Promise<void> {
  await getRootDb().execute('select 1');
}

/** Drains the process-wide pool and clears all initialized state. */
export async function closeDb(): Promise<void> {
  const currentPool = pool;
  pool = null;
  handle = null;
  if (currentPool) {
    await currentPool.end();
  }
}
