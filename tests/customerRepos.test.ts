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
const { linkIdentity, findCustomerIdByIdentity } =
  await import('../src/lib/services/db/repos/authIdentitiesRepo.js');
const { insertSession, findValidSession, deleteSession, deleteExpiredSessions } =
  await import('../src/lib/services/db/repos/sessionsRepo.js');
const { findYouTubeAuth, upsertYouTubeAuth, deleteYouTubeAuth } =
  await import('../src/lib/services/db/repos/youtubeAuthRepo.js');

const GOOGLE_SUB = 'google-sub-001';
const CHANNEL_ID = 'UC_test_channel';

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

beforeEach(() => {
  sqlite.exec(
    'DELETE FROM sessions; DELETE FROM youtube_auth; DELETE FROM auth_identities; DELETE FROM customers;',
  );
});

describe('customersRepo and authIdentitiesRepo', () => {
  /** Signing in creates the person and the login separately, then joins them. */
  function signIn(sub: string, overrides: Record<string, unknown> = {}) {
    const existingId = findCustomerIdByIdentity('google', sub);
    const customer = existingId
      ? updateCustomerProfile(existingId, { channelId: CHANNEL_ID, ...overrides })
      : createCustomer({ channelId: CHANNEL_ID, ...overrides });
    linkIdentity({ customerId: customer.id, provider: 'google', providerAccountId: sub });
    return customer;
  }

  it('creates a customer that carries no provider field at all', () => {
    const created = signIn(GOOGLE_SUB, { email: 'creator@example.com', name: 'Test Creator' });

    expect(created.channelId).toBe(CHANNEL_ID);
    expect(created).not.toHaveProperty('googleSub');
    expect(findCustomerById(created.id)?.email).toBe('creator@example.com');
    expect(findCustomerByChannelId(CHANNEL_ID)?.id).toBe(created.id);
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
    const second = updateCustomerProfile(first.id, { name: 'No channel this time' });

    expect(second.channelId).toBe(CHANNEL_ID);
  });

  it('returns null for unknown lookups', () => {
    expect(findCustomerById('nope')).toBeNull();
    expect(findCustomerByChannelId('nope')).toBeNull();
  });
});

describe('sessionsRepo', () => {
  it('stores a hashed session and finds it while unexpired', () => {
    const customer = createCustomer({ channelId: CHANNEL_ID });
    const idHash = hash('raw-token');
    insertSession(idHash, customer.id, Date.now() + 60_000);

    const found = findValidSession(idHash);
    expect(found?.customerId).toBe(customer.id);
  });

  it('does not return an expired session', () => {
    const customer = createCustomer({ channelId: CHANNEL_ID });
    const idHash = hash('expired-token');
    insertSession(idHash, customer.id, Date.now() - 1);

    expect(findValidSession(idHash)).toBeNull();
  });

  it('does not match on the raw token, only its hash', () => {
    const customer = createCustomer({ channelId: CHANNEL_ID });
    insertSession(hash('raw-token'), customer.id, Date.now() + 60_000);

    expect(findValidSession('raw-token')).toBeNull();
  });

  it('deletes one session and sweeps expired ones', () => {
    const customer = createCustomer({ channelId: CHANNEL_ID });
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

describe('youtubeAuthRepo', () => {
  it('stores and reads tokens for a customer', () => {
    const customer = createCustomer({ channelId: CHANNEL_ID });
    upsertYouTubeAuth({
      customerId: customer.id,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      scope: 'openid youtube.readonly',
      channelId: CHANNEL_ID,
    });

    const auth = findYouTubeAuth(customer.id);
    expect(auth?.accessToken).toBe('access-1');
    expect(auth?.refreshToken).toBe('refresh-1');
  });

  it('keeps the stored refresh token when a later grant omits it', () => {
    const customer = createCustomer({ channelId: CHANNEL_ID });
    upsertYouTubeAuth({ customerId: customer.id, accessToken: 'a1', refreshToken: 'refresh-1' });
    upsertYouTubeAuth({ customerId: customer.id, accessToken: 'a2' });

    const auth = findYouTubeAuth(customer.id);
    expect(auth?.accessToken).toBe('a2');
    expect(auth?.refreshToken).toBe('refresh-1');
  });

  it('deletes tokens', () => {
    const customer = createCustomer({ channelId: CHANNEL_ID });
    upsertYouTubeAuth({ customerId: customer.id, accessToken: 'a1' });
    deleteYouTubeAuth(customer.id);

    expect(findYouTubeAuth(customer.id)).toBeNull();
  });
});
