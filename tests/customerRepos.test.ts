import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createHash } from 'node:crypto';
import path from 'node:path';
import * as schema from '../src/lib/services/db/schema.js';

// ── In-memory DB setup ────────────────────────────────────────────────────────

const sqlite = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

vi.mock('../src/lib/services/db/client.js', () => ({ db: testDb }));

// ── Import repos after the mock is in place ──────────────────────────────────

const { createCustomer, updateCustomerProfile, findCustomerById, findCustomerByChannelId } =
  await import('../src/lib/services/db/repos/customersRepo.js');
const { linkIdentity, findCustomerIdByIdentity, findIdentity, unlinkIdentity } =
  await import('../src/lib/services/db/repos/authIdentitiesRepo.js');
const { insertSession, findValidSession, deleteSession, deleteExpiredSessions } =
  await import('../src/lib/services/db/repos/sessionsRepo.js');

const GOOGLE_SUB = 'google-sub-001';
const CHANNEL_ID = 'UC_test_channel';

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

beforeEach(() => {
  sqlite.exec('DELETE FROM sessions; DELETE FROM auth_identities; DELETE FROM customers;');
});

describe('customersRepo and authIdentitiesRepo', () => {
  /** Signing in creates the person and the login separately, then joins them. */
  function signIn(sub: string, overrides: Record<string, unknown> = {}) {
    const existingId = findCustomerIdByIdentity('google', sub);
    const customer = existingId
      ? updateCustomerProfile(existingId, overrides)
      : createCustomer(overrides);
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: sub,
      channelId: CHANNEL_ID,
    });
    // Re-read: the channel arrives with the identity, not with the customer row.
    return findCustomerById(customer.id)!;
  }

  it('creates a customer that carries no provider field at all', () => {
    const created = signIn(GOOGLE_SUB, { email: 'creator@example.com', name: 'Test Creator' });

    expect(created.channelId).toBe(CHANNEL_ID);
    expect(created).not.toHaveProperty('googleSub');
    expect(findCustomerById(created.id)?.email).toBe('creator@example.com');
    expect(findCustomerByChannelId(CHANNEL_ID)?.id).toBe(created.id);
  });

  it('keeps the channel off the customers table entirely', () => {
    signIn(GOOGLE_SUB);
    const columns = sqlite.prepare('PRAGMA table_info(customers)').all() as { name: string }[];
    expect(columns.map((c) => c.name)).not.toContain('channel_id');
  });

  it('resolves a returning login back to the same customer', () => {
    const first = signIn(GOOGLE_SUB);
    expect(findCustomerIdByIdentity('google', GOOGLE_SUB)).toBe(first.id);

    const second = signIn(GOOGLE_SUB, { name: 'Renamed' });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Renamed');
  });

  it('does not know a login it has never seen', () => {
    signIn(GOOGLE_SUB);
    expect(findCustomerIdByIdentity('google', 'someone-else')).toBeNull();
  });

  it('lets one person hold several logins', () => {
    const customer = signIn(GOOGLE_SUB);
    linkIdentity({ customerId: customer.id, provider: 'google', providerAccountId: 'second-sub' });

    expect(findCustomerIdByIdentity('google', 'second-sub')).toBe(customer.id);
    expect(findCustomerIdByIdentity('google', GOOGLE_SUB)).toBe(customer.id);
  });

  it('linking the same login twice does not duplicate it', () => {
    const customer = signIn(GOOGLE_SUB);
    linkIdentity({ customerId: customer.id, provider: 'google', providerAccountId: GOOGLE_SUB });

    const count = (
      sqlite.prepare('SELECT COUNT(*) AS n FROM auth_identities').get() as { n: number }
    ).n;
    expect(count).toBe(1);
  });

  it('keeps an existing channel link when a later sign-in omits it', () => {
    const first = signIn(GOOGLE_SUB);
    linkIdentity({ customerId: first.id, provider: 'google', providerAccountId: GOOGLE_SUB });

    expect(findCustomerById(first.id)?.channelId).toBe(CHANNEL_ID);
  });

  it('returns null for unknown lookups', () => {
    expect(findCustomerById('nope')).toBeNull();
    expect(findCustomerByChannelId('nope')).toBeNull();
  });
});

describe('identity tokens', () => {
  it('stores and reads the tokens the provider issued', () => {
    const customer = createCustomer({});
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      scope: 'openid youtube.readonly',
      channelId: CHANNEL_ID,
    });

    const identity = findIdentity(customer.id, 'google');
    expect(identity?.accessToken).toBe('access-1');
    expect(identity?.refreshToken).toBe('refresh-1');
    expect(identity?.channelId).toBe(CHANNEL_ID);
  });

  it('keeps the stored refresh token when a later grant omits it', () => {
    const customer = createCustomer({});
    const base = { customerId: customer.id, provider: 'google' as const, providerAccountId: 'sub' };
    linkIdentity({ ...base, accessToken: 'a1', refreshToken: 'refresh-1' });
    linkIdentity({ ...base, accessToken: 'a2' });

    const identity = findIdentity(customer.id, 'google');
    expect(identity?.accessToken).toBe('a2');
    expect(identity?.refreshToken).toBe('refresh-1');
  });

  it('round-trips provider-specific metadata', () => {
    const customer = createCustomer({});
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      metadata: { uploadsPlaylistId: 'UU_test' },
    });

    expect(findIdentity(customer.id, 'google')?.metadata).toEqual({ uploadsPlaylistId: 'UU_test' });
  });

  it('unlinks a login and the tokens it carried', () => {
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

describe('sessionsRepo', () => {
  it('stores a hashed session and finds it while unexpired', () => {
    const customer = createCustomer({});
    const idHash = hash('raw-token');
    insertSession(idHash, customer.id, Date.now() + 60_000);

    const found = findValidSession(idHash);
    expect(found?.customerId).toBe(customer.id);
  });

  it('does not return an expired session', () => {
    const customer = createCustomer({});
    const idHash = hash('expired-token');
    insertSession(idHash, customer.id, Date.now() - 1);

    expect(findValidSession(idHash)).toBeNull();
  });

  it('does not match on the raw token, only its hash', () => {
    const customer = createCustomer({});
    insertSession(hash('raw-token'), customer.id, Date.now() + 60_000);

    expect(findValidSession('raw-token')).toBeNull();
  });

  it('deletes one session and sweeps expired ones', () => {
    const customer = createCustomer({});
    const live = hash('live');
    const dead = hash('dead');
    insertSession(live, customer.id, Date.now() + 60_000);
    insertSession(dead, customer.id, Date.now() - 1);

    deleteExpiredSessions();
    expect(findValidSession(live)?.customerId).toBe(customer.id);

    deleteSession(live);
    expect(findValidSession(live)).toBeNull();
  });
});
