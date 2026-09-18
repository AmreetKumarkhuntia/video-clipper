import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomer, findCustomerById, findRolePermissions } from '@lib/services/db/index.js';
import { log } from '@lib/utils/logger.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../../support/postgres.js';

let database: PostgresTestDatabase;

beforeAll(async () => {
  database = await createPostgresTestDatabase('roles_repo');
});

beforeEach(async () => {
  vi.restoreAllMocks();
  await database.reset();
  await database.query(
    `update roles
     set permissions = case id
       when 'admin' then '["settings:write"]'::jsonb
       else '[]'::jsonb
     end`,
  );
});

afterAll(async () => {
  await database.close();
});

describe('rolesRepo', () => {
  it('loads seeded role permissions', async () => {
    const roles = await database.query<{ id: string; permissions: unknown }>(
      'select id, permissions from roles order by rank',
    );
    expect(roles.rows).toEqual([
      { id: 'customer', permissions: [] },
      { id: 'admin', permissions: ['settings:write'] },
    ]);
    expect(await findRolePermissions('customer')).toEqual([]);
    expect(await findRolePermissions('admin')).toEqual(['settings:write']);
  });

  it('reflects stored permission changes on the next customer load', async () => {
    const customer = await createCustomer({});
    await database.query('update roles set permissions = $1::jsonb where id = $2', [
      '["settings:write"]',
      'customer',
    ]);
    expect((await findCustomerById(customer.id))?.permissions).toEqual(['settings:write']);

    await database.query('update roles set permissions = $1::jsonb where id = $2', [
      '[]',
      'customer',
    ]);
    expect((await findCustomerById(customer.id))?.permissions).toEqual([]);
  });

  it('grants nothing and warns when a stored role is missing', async () => {
    const warning = vi.spyOn(log, 'warn').mockImplementation(() => {});
    expect(await findRolePermissions('missing')).toEqual([]);
    expect(warning).toHaveBeenCalledWith('db', 'stored role is missing; no permissions granted');
  });

  it.each([{}, 'settings:write', [1], ['unknown:permission']])(
    'fails closed for invalid stored permissions %j',
    async (value) => {
      const warning = vi.spyOn(log, 'warn').mockImplementation(() => {});
      await database.query('update roles set permissions = $1::jsonb where id = $2', [
        JSON.stringify(value),
        'customer',
      ]);

      expect(await findRolePermissions('customer')).toEqual([]);
      expect(warning).toHaveBeenCalledWith(
        'db',
        'stored role permissions are invalid; no permissions granted',
      );
    },
  );

  it('rejects malformed JSON before it can become stored permissions', async () => {
    await expect(
      database.query('update roles set permissions = $1::jsonb where id = $2', [
        'broken-json',
        'customer',
      ]),
    ).rejects.toMatchObject({ code: '22P02' });
    expect(await findRolePermissions('customer')).toEqual([]);
  });

  it('restricts deletion of a role assigned to a customer', async () => {
    await createCustomer({});
    await expect(database.query("delete from roles where id = 'customer'")).rejects.toMatchObject({
      code: '23503',
    });
  });
});
