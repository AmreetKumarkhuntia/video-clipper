import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from '@lib/services/db/schema.js';

const sqlite = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

vi.mock('@lib/services/db/client.js', () => ({ db: testDb }));

const {
  createCustomer,
  findCustomerByChannelId,
  findCustomerById,
  setCustomerRole,
  updateCustomerProfile,
} = await import('@lib/services/db/repos/customersRepo.js');
const { linkIdentity } = await import('@lib/services/db/repos/authIdentitiesRepo.js');

beforeEach(() => {
  sqlite.exec('DELETE FROM sessions; DELETE FROM auth_identities; DELETE FROM customers;');
});

afterAll(() => sqlite.close());

describe('customersRepo', () => {
  it('creates and updates a customer without provider-specific fields', () => {
    const created = createCustomer({ email: 'creator@example.com', name: 'Test Creator' });

    expect(created.email).toBe('creator@example.com');
    expect(created).not.toHaveProperty('googleSub');
    expect(created.role).toBe('customer');
    expect(created.permissions).toEqual([]);

    const updated = updateCustomerProfile(created.id, { name: 'Renamed' });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
  });

  it('resolves the channel projected from a linked identity', () => {
    const customer = createCustomer({});
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: 'google-sub-001',
      channelId: 'UC_test_channel',
    });

    expect(findCustomerById(customer.id)?.channelId).toBe('UC_test_channel');
    expect(findCustomerByChannelId('UC_test_channel')?.id).toBe(customer.id);
  });

  it('uses the most recently refreshed identity when several carry a channel', () => {
    const customer = createCustomer({});
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: 'first-sub',
      channelId: 'UC_first',
    });
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: 'second-sub',
      channelId: 'UC_second',
    });
    sqlite
      .prepare('UPDATE auth_identities SET updated_at = ? WHERE provider_account_id = ?')
      .run(Date.now() + 10_000, 'first-sub');

    expect(findCustomerById(customer.id)?.channelId).toBe('UC_first');

    sqlite
      .prepare('UPDATE auth_identities SET updated_at = ? WHERE provider_account_id = ?')
      .run(Date.now() + 20_000, 'second-sub');
    expect(findCustomerById(customer.id)?.channelId).toBe('UC_second');
  });

  it('returns null for unknown customer and channel lookups', () => {
    expect(findCustomerById('nope')).toBeNull();
    expect(findCustomerByChannelId('nope')).toBeNull();
  });

  it('promotes and demotes a customer through the assigned role', () => {
    const customer = createCustomer({});
    const admin = setCustomerRole(customer.id, 'admin');

    expect(admin.role).toBe('admin');
    expect(admin.permissions).toEqual(['settings:write']);
    expect(findCustomerById(customer.id)?.permissions).toEqual(['settings:write']);
    expect(setCustomerRole(customer.id, 'customer').permissions).toEqual([]);
  });
});
