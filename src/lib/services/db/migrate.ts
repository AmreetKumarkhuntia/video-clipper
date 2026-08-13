import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getDb } from './client.js';
import { log } from '@lib/utils/logger.js';
import { PACKAGE_ROOT } from '@lib/utils/paths.js';
import path from 'node:path';

let migrated = false;

export function runMigrations(folder = path.join(PACKAGE_ROOT, 'drizzle')): void {
  if (migrated) return;
  migrated = true;
  log.info('db', 'running migrations', 'startup', { folder });
  migrate(getDb(), { migrationsFolder: folder });
  log.info('db', 'migrations complete', 'startup');
}
