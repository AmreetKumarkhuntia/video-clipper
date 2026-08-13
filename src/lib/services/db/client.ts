import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getUserConfigDir } from '@lib/utils/paths.js';
import * as schema from './schema.js';

let handle: BetterSQLite3Database<typeof schema> | null = null;

/**
 * Opens (or reopens) the SQLite database at the given path and makes it the
 * active handle. Called implicitly with the default path on first query;
 * call it explicitly first to point the library at a different database.
 *
 * Default resolution: `LIBRARY_DB_PATH` env var, else
 * `~/.config/video-clipper/library.sqlite`.
 */
export function initDb(dbPath?: string): BetterSQLite3Database<typeof schema> {
  const resolved =
    dbPath ?? process.env.LIBRARY_DB_PATH ?? path.join(getUserConfigDir(), 'library.sqlite');

  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const sqlite = new Database(resolved);
  sqlite.pragma('journal_mode = WAL');
  handle = drizzle(sqlite, { schema });
  return handle;
}

/** Returns the active database handle, opening the default database lazily. */
export function getDb(): BetterSQLite3Database<typeof schema> {
  return handle ?? initDb();
}

/**
 * Lazy database handle. Repos import this as a plain value; the underlying
 * connection is not opened until the first property access, so importing a
 * repo module has no side effects.
 */
export const db: BetterSQLite3Database<typeof schema> = new Proxy(
  {} as BetterSQLite3Database<typeof schema>,
  {
    get(_target, prop) {
      const real = getDb();
      const value = Reflect.get(real as object, prop, real);
      return typeof value === 'function' ? value.bind(real) : value;
    },
  },
);
