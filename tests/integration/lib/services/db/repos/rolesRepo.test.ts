import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@lib/services/db/schema.js';
import { log } from '@lib/utils/logger.js';

const sqlite = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

vi.mock('@lib/services/db/client.js', () => ({ db: testDb }));

const { createCustomer, findCustomerById } =
  await import('@lib/services/db/repos/customersRepo.js');
const { findRolePermissions } = await import('@lib/services/db/repos/rolesRepo.js');

beforeEach(() => {
  sqlite.exec('DELETE FROM sessions; DELETE FROM auth_identities; DELETE FROM customers;');
  sqlite.prepare('UPDATE roles SET permissions = ? WHERE id = ?').run('[]', 'customer');
  sqlite
    .prepare('UPDATE roles SET permissions = ? WHERE id = ?')
    .run('["settings:write"]', 'admin');
});

afterAll(() => sqlite.close());

describe('rolesRepo', () => {
  it('loads seeded role permissions', () => {
    const roles = sqlite.prepare('SELECT id FROM roles ORDER BY rank').all() as { id: string }[];
    expect(roles.map((role) => role.id)).toEqual(['customer', 'admin']);
    expect(findRolePermissions('customer')).toEqual([]);
    expect(findRolePermissions('admin')).toEqual(['settings:write']);
  });

  it('reflects stored permission changes on the next customer load', () => {
    const customer = createCustomer({});
    sqlite
      .prepare('UPDATE roles SET permissions = ? WHERE id = ?')
      .run('["settings:write"]', 'customer');
    expect(findCustomerById(customer.id)?.permissions).toEqual(['settings:write']);

    sqlite.prepare('UPDATE roles SET permissions = ? WHERE id = ?').run('[]', 'customer');
    expect(findCustomerById(customer.id)?.permissions).toEqual([]);
  });

  it('grants nothing and warns when a stored role is missing', () => {
    const warning = vi.spyOn(log, 'warn').mockImplementation(() => {});
    expect(findRolePermissions('missing')).toEqual([]);
    expect(warning).toHaveBeenCalledWith('db', 'stored role is missing; no permissions granted');
  });

  it.each(['null', '{}', '"settings:write"', '[1]', '["unknown:permission"]', 'broken-json'])(
    'fails closed for invalid stored permissions %s',
    (value) => {
      const warning = vi.spyOn(log, 'warn').mockImplementation(() => {});
      sqlite.prepare('UPDATE roles SET permissions = ? WHERE id = ?').run(value, 'customer');

      expect(findRolePermissions('customer')).toEqual([]);
      expect(warning).toHaveBeenCalledWith(
        'db',
        'stored role permissions are invalid; no permissions granted',
      );
      warning.mockRestore();
    },
  );
});
