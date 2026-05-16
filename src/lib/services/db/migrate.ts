import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './client.js';
import { log } from '@lib/utils/logger.js';
import path from 'node:path';

let migrated = false;

export function runMigrations(): void {
  if (migrated) return;
  migrated = true;
  const folder = path.join(process.cwd(), 'drizzle');
  log.info('db', 'running migrations', 'startup', { folder });
  migrate(db, { migrationsFolder: folder });
  log.info('db', 'migrations complete', 'startup');
}
