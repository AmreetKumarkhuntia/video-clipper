import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as schema from './schema.js';

const dbPath =
  process.env.LIBRARY_DB_PATH ??
  path.join(os.homedir(), '.config', 'video-clipper', 'library.sqlite');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
export const db = drizzle(sqlite, { schema });
