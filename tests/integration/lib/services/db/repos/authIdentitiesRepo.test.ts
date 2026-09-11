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

const { createCustomer } = await import('@lib/services/db/repos/customersRepo.js');
const {
  findCustomerIdByIdentity,
  findIdentity,
  linkIdentity,
  reencryptIdentityTokens,
  unlinkIdentity,
} = await import('@lib/services/db/repos/authIdentitiesRepo.js');

const GOOGLE_SUB = 'google-sub-001';

beforeEach(() => {
  sqlite.exec('DELETE FROM sessions; DELETE FROM auth_identities; DELETE FROM customers;');
});

afterAll(() => sqlite.close());

describe('authIdentitiesRepo', () => {
  it('resolves a provider identity and allows several logins for one customer', () => {
    const customer = createCustomer({});
    linkIdentity({ customerId: customer.id, provider: 'google', providerAccountId: GOOGLE_SUB });
    linkIdentity({ customerId: customer.id, provider: 'google', providerAccountId: 'second-sub' });

    expect(findCustomerIdByIdentity('google', GOOGLE_SUB)).toBe(customer.id);
    expect(findCustomerIdByIdentity('google', 'second-sub')).toBe(customer.id);
    expect(findCustomerIdByIdentity('google', 'unknown-sub')).toBeNull();
  });

  it('updates an existing identity without duplicating it or dropping its channel', () => {
    const customer = createCustomer({});
    const base = {
      customerId: customer.id,
      provider: 'google' as const,
      providerAccountId: GOOGLE_SUB,
    };
    linkIdentity({ ...base, channelId: 'UC_test_channel' });
    linkIdentity(base);

    const count = sqlite.prepare('SELECT COUNT(*) FROM auth_identities').pluck().get();
    expect(count).toBe(1);
    expect(findIdentity(customer.id, 'google')?.channelId).toBe('UC_test_channel');
  });

  it('round-trips provider tokens and metadata', () => {
    const customer = createCustomer({});
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      scope: 'openid youtube.readonly',
      channelId: 'UC_test_channel',
      metadata: { uploadsPlaylistId: 'UU_test' },
    });

    expect(findIdentity(customer.id, 'google')).toMatchObject({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      channelId: 'UC_test_channel',
      metadata: { uploadsPlaylistId: 'UU_test' },
    });
  });

  it('keeps an existing refresh token when a later grant omits it', () => {
    const customer = createCustomer({});
    const base = {
      customerId: customer.id,
      provider: 'google' as const,
      providerAccountId: GOOGLE_SUB,
    };
    linkIdentity({ ...base, accessToken: 'a1', refreshToken: 'refresh-1' });
    linkIdentity({ ...base, accessToken: 'a2' });

    expect(findIdentity(customer.id, 'google')).toMatchObject({
      accessToken: 'a2',
      refreshToken: 'refresh-1',
    });
  });

  it('merges metadata without letting an empty refresh erase stored keys', () => {
    const customer = createCustomer({});
    const base = {
      customerId: customer.id,
      provider: 'google' as const,
      providerAccountId: GOOGLE_SUB,
    };
    linkIdentity({ ...base, metadata: { uploadsPlaylistId: 'UU_test' } });
    linkIdentity({ ...base, metadata: {} });
    linkIdentity({ ...base, metadata: { channelThumbnailUrl: 'https://img.example/t.jpg' } });

    expect(findIdentity(customer.id, 'google')?.metadata).toEqual({
      uploadsPlaylistId: 'UU_test',
      channelThumbnailUrl: 'https://img.example/t.jpg',
    });
  });

  it('stores tokens encrypted while returning plaintext to the caller', () => {
    const customer = createCustomer({});
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });

    const raw = sqlite
      .prepare(
        'SELECT access_token AS accessToken, refresh_token AS refreshToken FROM auth_identities',
      )
      .get() as { accessToken: string; refreshToken: string };
    expect(raw.accessToken).toMatch(/^enc:v1:/);
    expect(raw.refreshToken).toMatch(/^enc:v1:/);
    expect(raw.accessToken).not.toContain('access-1');
    expect(findIdentity(customer.id, 'google')?.accessToken).toBe('access-1');
  });

  it('reads legacy plaintext and encrypts a retained token on the next write', () => {
    const customer = createCustomer({});
    sqlite
      .prepare(
        `INSERT INTO auth_identities (id, customer_id, provider, provider_account_id, access_token, refresh_token, metadata, created_at, updated_at)
         VALUES ('legacy', ?, 'google', ?, 'old-access', 'old-refresh', '{}', 1, 1)`,
      )
      .run(customer.id, GOOGLE_SUB);

    expect(findIdentity(customer.id, 'google')?.refreshToken).toBe('old-refresh');
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      accessToken: 'new-access',
    });

    const stored = sqlite
      .prepare('SELECT refresh_token FROM auth_identities')
      .pluck()
      .get() as string;
    expect(stored).toMatch(/^enc:v1:/);
    expect(findIdentity(customer.id, 'google')?.refreshToken).toBe('old-refresh');
  });

  it('sweeps legacy plaintext tokens once', () => {
    const customer = createCustomer({});
    sqlite
      .prepare(
        `INSERT INTO auth_identities (id, customer_id, provider, provider_account_id, access_token, metadata, created_at, updated_at)
         VALUES ('legacy', ?, 'google', ?, 'old-access', '{}', 1, 1)`,
      )
      .run(customer.id, GOOGLE_SUB);

    expect(reencryptIdentityTokens()).toBe(1);
    expect(reencryptIdentityTokens()).toBe(0);
    expect(findIdentity(customer.id, 'google')?.accessToken).toBe('old-access');
  });

  it('treats an undecryptable token as absent instead of failing the identity read', () => {
    const customer = createCustomer({});
    sqlite
      .prepare(
        `INSERT INTO auth_identities (id, customer_id, provider, provider_account_id, access_token, metadata, created_at, updated_at)
         VALUES ('broken', ?, 'google', ?, 'enc:v1:not:really:encrypted', '{}', 1, 1)`,
      )
      .run(customer.id, GOOGLE_SUB);

    const identity = findIdentity(customer.id, 'google');
    expect(identity).not.toBeNull();
    expect(identity?.accessToken).toBeUndefined();
  });

  it('unlinks an identity and its tokens', () => {
    const customer = createCustomer({});
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      accessToken: 'a1',
    });

    unlinkIdentity(customer.id, 'google');
    expect(findIdentity(customer.id, 'google')).toBeNull();
  });
});
