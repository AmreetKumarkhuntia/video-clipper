import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createCustomer,
  findCustomerIdByIdentity,
  findIdentity,
  insertSession,
  linkIdentity,
  reencryptIdentityTokens,
  unlinkIdentity,
} from '@lib/services/db/index.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../../support/postgres.js';
import { seedChannel } from '../postgresFixtures.js';

const GOOGLE_SUB = 'google-sub-001';
const CHANNEL_ID = 'UC_test_channel';
let database: PostgresTestDatabase;

async function insertRawIdentity(
  customerId: string,
  identityId: string,
  accessToken: string,
  refreshToken: string | null = null,
): Promise<void> {
  await database.query(
    `insert into auth_identities
       (id, customer_id, provider, provider_account_id, access_token, refresh_token, metadata,
        created_at, updated_at)
     values ($1, $2, 'google', $3, $4, $5, '{}'::jsonb, $6, $6)`,
    [identityId, customerId, GOOGLE_SUB, accessToken, refreshToken, new Date()],
  );
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('auth_identities_repo');
});

beforeEach(async () => {
  await database.reset();
  await seedChannel(database, CHANNEL_ID);
});

afterAll(async () => {
  await database.close();
});

describe('authIdentitiesRepo', () => {
  it('resolves a provider identity and allows several logins for one customer', async () => {
    const customer = await createCustomer({});
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
    });
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: 'second-sub',
    });

    expect(await findCustomerIdByIdentity('google', GOOGLE_SUB)).toBe(customer.id);
    expect(await findCustomerIdByIdentity('google', 'second-sub')).toBe(customer.id);
    expect(await findCustomerIdByIdentity('google', 'unknown-sub')).toBeNull();
  });

  it('updates an existing identity without duplicating it or dropping its channel', async () => {
    const customer = await createCustomer({});
    const base = {
      customerId: customer.id,
      provider: 'google' as const,
      providerAccountId: GOOGLE_SUB,
    };
    await linkIdentity({ ...base, channelId: CHANNEL_ID });
    await linkIdentity(base);

    const count = await database.query<{ count: number }>(
      'select count(*)::int as count from auth_identities',
    );
    expect(count.rows[0]?.count).toBe(1);
    expect((await findIdentity(customer.id, 'google'))?.channelId).toBe(CHANNEL_ID);
  });

  it('keeps the identity and clears its channel reference when the channel is deleted', async () => {
    const customer = await createCustomer({});
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      channelId: CHANNEL_ID,
    });

    await database.query('delete from channels where id = $1', [CHANNEL_ID]);

    expect(await findIdentity(customer.id, 'google')).toMatchObject({
      customerId: customer.id,
      providerAccountId: GOOGLE_SUB,
    });
    expect((await findIdentity(customer.id, 'google'))?.channelId).toBeUndefined();
  });

  it('round-trips encrypted tokens, expiry time, and JSONB metadata', async () => {
    const customer = await createCustomer({});
    const expiryDate = Date.parse('2026-03-04T05:06:07.890Z');
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiryDate,
      scope: 'openid youtube.readonly',
      channelId: CHANNEL_ID,
      metadata: { uploadsPlaylistId: 'UU_test' },
    });

    expect(await findIdentity(customer.id, 'google')).toMatchObject({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiryDate,
      channelId: CHANNEL_ID,
      metadata: { uploadsPlaylistId: 'UU_test' },
    });

    const raw = await database.query<{
      access_token: string;
      refresh_token: string;
      expiry_date: Date;
      metadata: unknown;
    }>('select access_token, refresh_token, expiry_date, metadata from auth_identities limit 1');
    expect(raw.rows[0]?.access_token).toMatch(/^enc:v1:/);
    expect(raw.rows[0]?.refresh_token).toMatch(/^enc:v1:/);
    expect(raw.rows[0]?.access_token).not.toContain('access-1');
    expect(raw.rows[0]?.expiry_date).toBeInstanceOf(Date);
    expect(raw.rows[0]?.metadata).toEqual({ uploadsPlaylistId: 'UU_test' });
  });

  it('keeps an existing refresh token and merges metadata on later grants', async () => {
    const customer = await createCustomer({});
    const base = {
      customerId: customer.id,
      provider: 'google' as const,
      providerAccountId: GOOGLE_SUB,
    };
    await linkIdentity({
      ...base,
      accessToken: 'a1',
      refreshToken: 'refresh-1',
      metadata: { uploadsPlaylistId: 'UU_test' },
    });
    await linkIdentity({ ...base, accessToken: 'a2', metadata: {} });
    await linkIdentity({
      ...base,
      accessToken: 'a3',
      metadata: { channelThumbnailUrl: 'https://img.example/t.jpg' },
    });

    expect(await findIdentity(customer.id, 'google')).toMatchObject({
      accessToken: 'a3',
      refreshToken: 'refresh-1',
      metadata: {
        uploadsPlaylistId: 'UU_test',
        channelThumbnailUrl: 'https://img.example/t.jpg',
      },
    });
  });

  it('fails closed when stored JSONB metadata is not an object', async () => {
    const customer = await createCustomer({});
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
    });
    await database.query("update auth_identities set metadata = '[]'::jsonb");

    expect((await findIdentity(customer.id, 'google'))?.metadata).toEqual({});
  });

  it('reads legacy plaintext and encrypts a retained token on the next write', async () => {
    const customer = await createCustomer({});
    await insertRawIdentity(customer.id, 'legacy', 'old-access', 'old-refresh');

    expect((await findIdentity(customer.id, 'google'))?.refreshToken).toBe('old-refresh');
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      accessToken: 'new-access',
    });

    const stored = await database.query<{ refresh_token: string }>(
      'select refresh_token from auth_identities where id = $1',
      ['legacy'],
    );
    expect(stored.rows[0]?.refresh_token).toMatch(/^enc:v1:/);
    expect((await findIdentity(customer.id, 'google'))?.refreshToken).toBe('old-refresh');
  });

  it('sweeps legacy plaintext tokens once', async () => {
    const customer = await createCustomer({});
    await insertRawIdentity(customer.id, 'legacy', 'old-access');

    expect(await reencryptIdentityTokens()).toBe(1);
    expect(await reencryptIdentityTokens()).toBe(0);
    expect((await findIdentity(customer.id, 'google'))?.accessToken).toBe('old-access');
  });

  it('treats an undecryptable token as absent instead of failing the identity read', async () => {
    const customer = await createCustomer({});
    await insertRawIdentity(customer.id, 'broken', 'enc:v1:not:really:encrypted');

    const identity = await findIdentity(customer.id, 'google');
    expect(identity).not.toBeNull();
    expect(identity?.accessToken).toBeUndefined();
  });

  it('unlinks an identity and its tokens', async () => {
    const customer = await createCustomer({});
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      accessToken: 'a1',
    });

    await unlinkIdentity(customer.id, 'google');
    expect(await findIdentity(customer.id, 'google')).toBeNull();
  });

  it('allows only one concurrent claim for the same provider channel', async () => {
    const [first, second] = await Promise.all([createCustomer({}), createCustomer({})]);
    const claims = await Promise.allSettled([
      linkIdentity({
        customerId: first.id,
        provider: 'google',
        providerAccountId: 'first-sub',
        channelId: CHANNEL_ID,
      }),
      linkIdentity({
        customerId: second.id,
        provider: 'google',
        providerAccountId: 'second-sub',
        channelId: CHANNEL_ID,
      }),
    ]);

    expect(claims.filter((claim) => claim.status === 'fulfilled')).toHaveLength(1);
    expect(claims.filter((claim) => claim.status === 'rejected')).toHaveLength(1);
    const count = await database.query<{ count: number }>(
      'select count(*)::int as count from auth_identities where channel_id = $1',
      [CHANNEL_ID],
    );
    expect(count.rows[0]?.count).toBe(1);
  });

  it('cascades identities and sessions when a customer is deleted', async () => {
    const customer = await createCustomer({});
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
    });
    await insertSession('session-hash', customer.id, Date.now() + 60_000);

    await database.query('delete from customers where id = $1', [customer.id]);

    const remaining = await database.query<{ identities: number; sessions: number }>(
      `select
         (select count(*)::int from auth_identities where customer_id = $1) as identities,
         (select count(*)::int from sessions where customer_id = $1) as sessions`,
      [customer.id],
    );
    expect(remaining.rows[0]).toEqual({ identities: 0, sessions: 0 });
  });
});
