import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const migrationsFolder = path.join(process.cwd(), 'drizzle');
const databases: Database.Database[] = [];

function createDatabase(preRbac: boolean = false): Database.Database {
  const sqlite = new Database(':memory:');
  databases.push(sqlite);
  if (preRbac) {
    // Build the schema through 0010, as shipped before this PR, with its migration ledger.
    sqlite.exec(
      'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)',
    );
    for (const migration of readMigrationFiles({ migrationsFolder }).slice(0, 11)) {
      for (const statement of migration.sql) sqlite.exec(statement);
      sqlite
        .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
        .run(migration.hash, migration.folderMillis);
    }
  }
  return sqlite;
}

function upgrade(sqlite: Database.Database): void {
  migrate(drizzle(sqlite), { migrationsFolder });
}

afterEach(() => {
  for (const sqlite of databases.splice(0)) sqlite.close();
});

describe('auth storage migration', () => {
  it('installs the final roles schema directly with unprivileged defaults', () => {
    const sqlite = createDatabase();
    upgrade(sqlite);

    expect(sqlite.prepare('SELECT id, permissions FROM roles ORDER BY rank').all()).toEqual([
      { id: 'customer', permissions: '[]' },
      { id: 'admin', permissions: '["settings:write"]' },
    ]);
    expect(
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('login_requests', 'role_permissions')",
        )
        .all(),
    ).toEqual([]);

    sqlite.exec(`
      INSERT INTO customers (id, created_at, updated_at) VALUES ('new-customer', 100, 100);
      INSERT INTO roles (id, rank, created_at) VALUES ('new-role', 50, 100);
    `);
    expect(
      sqlite.prepare("SELECT role_id FROM customers WHERE id = 'new-customer'").pluck().get(),
    ).toBe('customer');
    expect(
      sqlite.prepare("SELECT permissions FROM roles WHERE id = 'new-role'").pluck().get(),
    ).toBe('[]');
  });

  it('upgrades 0010 without losing customer data, identities, library entries or active sessions', () => {
    const sqlite = createDatabase(true);
    expect(() => sqlite.prepare('SELECT role_id FROM customers')).toThrow(/no such column/);
    expect(() => sqlite.prepare('SELECT * FROM roles')).toThrow(/no such table/);
    sqlite.exec(`
      INSERT INTO customers (id, email, name, avatar_url, created_at, updated_at)
      VALUES ('customer-one', 'creator@example.com', 'Creator', 'https://example.com/avatar', 100, 100),
             ('customer-two', 'admin@example.com', 'Administrator', NULL, 200, 200);
      INSERT INTO auth_identities
        (id, customer_id, provider, provider_account_id, access_token, refresh_token, metadata, created_at, updated_at)
      VALUES ('identity-one', 'customer-two', 'google', 'google-sub-one', 'stored-access', 'stored-refresh',
              '{"email_verified":true}', 200, 200);
      INSERT INTO sessions (id, customer_id, expires_at, created_at)
      VALUES ('session-hash', 'customer-two', 9999999999999, 200);
      INSERT INTO library_videos (id, customer_id, video_id, saved_at, created_at, updated_at)
      VALUES ('library-entry', 'customer-one', 'video-one', 100, 100, 100);
    `);
    const customerColumns = 'id, email, name, avatar_url, created_at, updated_at';
    const customers = sqlite.prepare(`SELECT ${customerColumns} FROM customers ORDER BY id`).all();
    const identities = sqlite.prepare('SELECT * FROM auth_identities').all();
    const sessions = sqlite.prepare('SELECT * FROM sessions').all();
    const libraryEntries = sqlite.prepare('SELECT * FROM library_videos').all();

    upgrade(sqlite);

    expect(sqlite.prepare(`SELECT ${customerColumns} FROM customers ORDER BY id`).all()).toEqual(
      customers,
    );
    expect(sqlite.prepare('SELECT id, role_id FROM customers ORDER BY id').all()).toEqual([
      { id: 'customer-one', role_id: 'customer' },
      { id: 'customer-two', role_id: 'customer' },
    ]);
    expect(sqlite.prepare('SELECT * FROM auth_identities').all()).toEqual(identities);
    expect(sqlite.prepare('SELECT * FROM sessions').all()).toEqual(sessions);
    expect(sqlite.prepare('SELECT * FROM library_videos').all()).toEqual(libraryEntries);
    expect(sqlite.prepare('SELECT id, permissions FROM roles ORDER BY rank').all()).toEqual([
      { id: 'customer', permissions: '[]' },
      { id: 'admin', permissions: '["settings:write"]' },
    ]);
    expect(() => sqlite.prepare('SELECT * FROM login_requests')).toThrow(/no such table/);
    expect(() => sqlite.prepare('SELECT * FROM role_permissions')).toThrow(/no such table/);
  });

  it('retains changed grants, custom roles and assignments when migrations run again', () => {
    const sqlite = createDatabase();
    upgrade(sqlite);
    sqlite.exec(`
      UPDATE roles SET permissions = '[]' WHERE id = 'admin';
      UPDATE roles SET permissions = '["settings:write"]' WHERE id = 'customer';
      INSERT INTO roles (id, rank, permissions, created_at)
      VALUES ('custom-role', 50, '["future:permission"]', 100);
      INSERT INTO customers (id, role_id, created_at, updated_at)
      VALUES ('admin-one', 'admin', 100, 100), ('custom-one', 'custom-role', 200, 200);
    `);
    const roles = sqlite.prepare('SELECT * FROM roles ORDER BY id').all();
    const customers = sqlite.prepare('SELECT * FROM customers ORDER BY id').all();
    const ledger = sqlite.prepare('SELECT * FROM __drizzle_migrations ORDER BY created_at').all();

    upgrade(sqlite);

    expect(sqlite.prepare('SELECT * FROM roles ORDER BY id').all()).toEqual(roles);
    expect(sqlite.prepare('SELECT * FROM customers ORDER BY id').all()).toEqual(customers);
    expect(sqlite.prepare('SELECT * FROM __drizzle_migrations ORDER BY created_at').all()).toEqual(
      ledger,
    );
  });

  it('links the consolidated snapshot directly to 0010 and journals only one auth migration', () => {
    const SnapshotSchema = z.object({
      id: z.string().uuid(),
      prevId: z.string().uuid(),
      tables: z.record(z.string(), z.unknown()),
    });
    const previous = SnapshotSchema.parse(
      JSON.parse(readFileSync(path.join(migrationsFolder, 'meta/0010_snapshot.json'), 'utf8')),
    );
    const current = SnapshotSchema.parse(
      JSON.parse(readFileSync(path.join(migrationsFolder, 'meta/0011_snapshot.json'), 'utf8')),
    );
    const journal = z
      .object({ entries: z.array(z.object({ idx: z.number().int(), tag: z.string() })) })
      .parse(JSON.parse(readFileSync(path.join(migrationsFolder, 'meta/_journal.json'), 'utf8')));

    expect(current.prevId).toBe(previous.id);
    expect(current.id).not.toBe(previous.id);
    expect(current.tables).not.toHaveProperty('role_permissions');
    expect(current.tables).not.toHaveProperty('login_requests');
    expect(current.tables.roles).toMatchObject({
      columns: { permissions: { type: 'text', notNull: true, default: "'[]'" } },
    });
    expect(current.tables.customers).toMatchObject({
      columns: { role_id: { type: 'text', notNull: true, default: "'customer'" } },
    });
    expect(journal.entries.filter((entry) => entry.idx >= 11)).toEqual([
      { idx: 11, tag: '0011_rbac_and_cli_login' },
    ]);
    expect(journal.entries.map((entry) => entry.tag)).not.toContain('0012_simplify_auth_storage');
  });
});
