import path from 'node:path';
import { sql } from 'drizzle-orm';
import { readMigrationFiles, type MigrationConfig } from 'drizzle-orm/migrator';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { log } from '@lib/utils/logger.js';
import { PACKAGE_ROOT } from '@lib/utils/paths.js';
import { getDb } from './client.js';

const DEFAULT_MIGRATIONS_FOLDER = path.join(PACKAGE_ROOT, 'drizzle');

/** Applies pending PostgreSQL migrations. Operators call this explicitly before API startup. */
export async function runMigrations(
  folder: string = DEFAULT_MIGRATIONS_FOLDER,
  options: Pick<MigrationConfig, 'migrationsSchema' | 'migrationsTable'> = {},
): Promise<void> {
  log.info('db', 'running migrations', 'migration', { folder });
  await migrate(getDb(), { migrationsFolder: folder, ...options });
  log.info('db', 'migrations complete', 'migration');
}

/** Fails when the database ledger does not match this build's latest migration. */
export async function assertMigrationsCurrent(
  folder: string = DEFAULT_MIGRATIONS_FOLDER,
  options: Pick<MigrationConfig, 'migrationsSchema' | 'migrationsTable'> = {},
): Promise<void> {
  const expectedMigrations = readMigrationFiles({ migrationsFolder: folder });
  const expected = expectedMigrations.at(-1);
  if (!expected) {
    throw new Error(`No database migrations were found in ${folder}.`);
  }

  const migrationsSchema = options.migrationsSchema ?? 'drizzle';
  const migrationsTable = options.migrationsTable ?? '__drizzle_migrations';

  let rows: { created_at: string | number | null; hash: string }[];
  try {
    const result = await getDb().execute<{ created_at: string | number | null; hash: string }>(sql`
      select created_at, hash
      from ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)}
      order by created_at desc
      limit 1
    `);
    rows = result.rows;
  } catch (cause) {
    throw new Error('Database schema is not initialized. Run `pnpm db:migrate` before startup.', {
      cause,
    });
  }

  const applied = rows[0];
  if (
    !applied ||
    Number(applied.created_at) !== expected.folderMillis ||
    applied.hash !== expected.hash
  ) {
    throw new Error('Database migrations are not current. Run `pnpm db:migrate` before startup.');
  }
}
