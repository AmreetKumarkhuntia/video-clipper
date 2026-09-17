import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createCustomer,
  findCustomerByChannelId,
  findCustomerById,
  linkIdentity,
  setCustomerRole,
  updateCustomerProfile,
} from '@lib/services/db/index.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../../support/postgres.js';
import { seedChannel } from '../postgresFixtures.js';

let database: PostgresTestDatabase;

beforeAll(async () => {
  database = await createPostgresTestDatabase('customers_repo');
});

beforeEach(async () => {
  await database.reset();
  await Promise.all(
    ['UC_test_channel', 'UC_first', 'UC_second'].map((id) => seedChannel(database, id)),
  );
});

afterAll(async () => {
  await database.close();
});

describe('customersRepo', () => {
  it('creates and updates a customer without provider-specific fields', async () => {
    const created = await createCustomer({
      email: 'creator@example.com',
      name: 'Test Creator',
    });

    expect(created.email).toBe('creator@example.com');
    expect(created).not.toHaveProperty('googleSub');
    expect(created.role).toBe('customer');
    expect(created.permissions).toEqual([]);
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);

    const updated = await updateCustomerProfile(created.id, { name: 'Renamed' });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
  });

  it('resolves the channel projected from a linked identity', async () => {
    const customer = await createCustomer({});
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: 'google-sub-001',
      channelId: 'UC_test_channel',
    });

    expect((await findCustomerById(customer.id))?.channelId).toBe('UC_test_channel');
    expect((await findCustomerByChannelId('UC_test_channel'))?.id).toBe(customer.id);
  });

  it('uses the most recently refreshed identity when several carry a channel', async () => {
    const customer = await createCustomer({});
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: 'first-sub',
      channelId: 'UC_first',
    });
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: 'second-sub',
      channelId: 'UC_second',
    });
    await database.query(
      'update auth_identities set updated_at = $1 where provider_account_id = $2',
      [new Date('2036-01-01T00:00:10.000Z'), 'first-sub'],
    );

    expect((await findCustomerById(customer.id))?.channelId).toBe('UC_first');

    await database.query(
      'update auth_identities set updated_at = $1 where provider_account_id = $2',
      [new Date('2036-01-01T00:00:20.000Z'), 'second-sub'],
    );
    expect((await findCustomerById(customer.id))?.channelId).toBe('UC_second');
  });

  it('sets an identity channel to null when its channel is deleted', async () => {
    const customer = await createCustomer({});
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: 'google-sub-001',
      channelId: 'UC_test_channel',
    });

    await database.query('delete from channels where id = $1', ['UC_test_channel']);

    expect((await findCustomerById(customer.id))?.channelId).toBeUndefined();
    expect(await findCustomerByChannelId('UC_test_channel')).toBeNull();
  });

  it('returns null for unknown customer and channel lookups', async () => {
    expect(await findCustomerById('nope')).toBeNull();
    expect(await findCustomerByChannelId('nope')).toBeNull();
  });

  it('promotes and demotes a customer through the assigned role', async () => {
    const customer = await createCustomer({});
    const admin = await setCustomerRole(customer.id, 'admin');

    expect(admin.role).toBe('admin');
    expect(admin.permissions).toEqual(['settings:write']);
    expect((await findCustomerById(customer.id))?.permissions).toEqual(['settings:write']);
    expect((await setCustomerRole(customer.id, 'customer')).permissions).toEqual([]);
  });
});
