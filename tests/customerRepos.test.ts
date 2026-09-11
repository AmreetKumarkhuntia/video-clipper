import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createHash } from 'node:crypto';
import path from 'node:path';
import * as schema from '../src/lib/services/db/schema.js';
import { log } from '../src/lib/utils/logger.js';

// ── In-memory DB setup ────────────────────────────────────────────────────────

const sqlite = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

vi.mock('../src/lib/services/db/client.js', () => ({ db: testDb }));

// ── Import repos after the mock is in place ──────────────────────────────────

const { createCustomer, updateCustomerProfile, findCustomerById, findCustomerByChannelId } =
  await import('../src/lib/services/db/repos/customersRepo.js');
const {
  linkIdentity,
  findCustomerIdByIdentity,
  findIdentity,
  unlinkIdentity,
  reencryptIdentityTokens,
} = await import('../src/lib/services/db/repos/authIdentitiesRepo.js');
const { insertSession, findValidSession, deleteSession, deleteExpiredSessions } =
  await import('../src/lib/services/db/repos/sessionsRepo.js');
const { setCustomerRole } = await import('../src/lib/services/db/repos/customersRepo.js');
const { findRolePermissions } = await import('../src/lib/services/db/repos/rolesRepo.js');

const GOOGLE_SUB = 'google-sub-001';
const CHANNEL_ID = 'UC_test_channel';

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

beforeEach(() => {
  sqlite.exec('DELETE FROM sessions; DELETE FROM auth_identities; DELETE FROM customers;');
  sqlite.prepare('UPDATE roles SET permissions = ? WHERE id = ?').run('[]', 'customer');
  sqlite
    .prepare('UPDATE roles SET permissions = ? WHERE id = ?')
    .run('["settings:write"]', 'admin');
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

  it('prefers the most recently refreshed identity when two carry a channel', () => {
    const customer = signIn(GOOGLE_SUB);
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: 'second-sub',
      channelId: 'UC_second',
    });
    // Force a clear ordering rather than relying on two writes in the same millisecond.
    sqlite
      .prepare('UPDATE auth_identities SET updated_at = ? WHERE provider_account_id = ?')
      .run(Date.now() + 10_000, GOOGLE_SUB);

    expect(findCustomerById(customer.id)?.channelId).toBe(CHANNEL_ID);

    sqlite
      .prepare('UPDATE auth_identities SET updated_at = ? WHERE provider_account_id = ?')
      .run(Date.now() + 20_000, 'second-sub');
    expect(findCustomerById(customer.id)?.channelId).toBe('UC_second');
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

  // Google always sends a metadata object, empty or not, so replacing the blob
  // wholesale would let a sign-in that saw no uploads playlist wipe a stored one.
  it('keeps stored metadata when a later sign-in sends an empty object', () => {
    const customer = createCustomer({});
    const base = { customerId: customer.id, provider: 'google' as const, providerAccountId: 'm-1' };
    linkIdentity({ ...base, metadata: { uploadsPlaylistId: 'UU_test' } });
    linkIdentity({ ...base, metadata: {} });

    expect(findIdentity(customer.id, 'google')?.metadata).toEqual({ uploadsPlaylistId: 'UU_test' });
  });

  it('merges metadata key by key rather than replacing the blob', () => {
    const customer = createCustomer({});
    const base = { customerId: customer.id, provider: 'google' as const, providerAccountId: 'm-2' };
    linkIdentity({ ...base, metadata: { uploadsPlaylistId: 'UU_test' } });
    linkIdentity({ ...base, metadata: { channelThumbnailUrl: 'https://img.example/t.jpg' } });

    expect(findIdentity(customer.id, 'google')?.metadata).toEqual({
      uploadsPlaylistId: 'UU_test',
      channelThumbnailUrl: 'https://img.example/t.jpg',
    });
  });

  it('stores tokens encrypted and reads them back plain', () => {
    const customer = createCustomer({});
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });

    const raw = sqlite
      .prepare('SELECT access_token AS a, refresh_token AS r FROM auth_identities')
      .get() as { a: string; r: string };
    expect(raw.a.startsWith('enc:v1:')).toBe(true);
    expect(raw.r.startsWith('enc:v1:')).toBe(true);
    expect(raw.a).not.toContain('access-1');

    const identity = findIdentity(customer.id, 'google');
    expect(identity?.accessToken).toBe('access-1');
    expect(identity?.refreshToken).toBe('refresh-1');
  });

  it('reads a row written before encryption, and encrypts it on the next write', () => {
    const customer = createCustomer({});
    sqlite
      .prepare(
        `INSERT INTO auth_identities (id, customer_id, provider, provider_account_id, access_token, refresh_token, metadata, created_at, updated_at)
         VALUES ('legacy', ?, 'google', ?, 'old-access', 'old-refresh', '{}', 1, 1)`,
      )
      .run(customer.id, GOOGLE_SUB);

    expect(findIdentity(customer.id, 'google')?.refreshToken).toBe('old-refresh');

    // The next grant omits a refresh token, so the kept one must be re-encrypted, not copied.
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: GOOGLE_SUB,
      accessToken: 'new-access',
    });
    const raw = sqlite.prepare('SELECT refresh_token AS r FROM auth_identities').get() as {
      r: string;
    };
    expect(raw.r.startsWith('enc:v1:')).toBe(true);
    expect(findIdentity(customer.id, 'google')?.refreshToken).toBe('old-refresh');
  });

  it('sweeps rows written before encryption once at startup', () => {
    const customer = createCustomer({});
    sqlite
      .prepare(
        `INSERT INTO auth_identities (id, customer_id, provider, provider_account_id, access_token, refresh_token, metadata, created_at, updated_at)
         VALUES ('legacy', ?, 'google', ?, 'old-access', NULL, '{}', 1, 1)`,
      )
      .run(customer.id, GOOGLE_SUB);

    expect(reencryptIdentityTokens()).toBe(1);
    expect(reencryptIdentityTokens()).toBe(0);
    const raw = sqlite.prepare('SELECT access_token AS a FROM auth_identities').get() as {
      a: string;
    };
    expect(raw.a.startsWith('enc:v1:')).toBe(true);
    expect(findIdentity(customer.id, 'google')?.accessToken).toBe('old-access');
  });

  it('treats a token it cannot decrypt as absent rather than failing the read', () => {
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

describe('roles and permissions', () => {
  it('seeds both roles and gives only admin the settings permission', () => {
    const roles = sqlite.prepare('SELECT id FROM roles ORDER BY rank').all() as { id: string }[];
    expect(roles.map((r) => r.id)).toEqual(['customer', 'admin']);
    expect(findRolePermissions('customer')).toEqual([]);
    expect(findRolePermissions('admin')).toEqual(['settings:write']);
  });

  it('starts everyone as a customer with no permissions', () => {
    const customer = createCustomer({ email: 'new@example.com' });
    expect(customer.role).toBe('customer');
    expect(customer.permissions).toEqual([]);
  });

  it('promotes and demotes through the role, and the permissions follow', () => {
    const customer = createCustomer({});
    const admin = setCustomerRole(customer.id, 'admin');
    expect(admin.role).toBe('admin');
    expect(admin.permissions).toEqual(['settings:write']);
    expect(findCustomerById(customer.id)?.permissions).toEqual(['settings:write']);

    expect(setCustomerRole(customer.id, 'customer').permissions).toEqual([]);
  });
});

describe('stored role permission validation', () => {
  it('reads permission changes on the next customer load', () => {
    const customer = createCustomer({});
    sqlite
      .prepare('UPDATE roles SET permissions = ? WHERE id = ?')
      .run('["settings:write"]', 'customer');
    expect(findCustomerById(customer.id)?.permissions).toEqual(['settings:write']);
    sqlite.prepare('UPDATE roles SET permissions = ? WHERE id = ?').run('[]', 'customer');
    expect(findCustomerById(customer.id)?.permissions).toEqual([]);
  });

  it('grants nothing for a missing role', () => {
    const warning = vi.spyOn(log, 'warn').mockImplementation(() => {});
    expect(findRolePermissions('missing')).toEqual([]);
    expect(warning).toHaveBeenCalledWith('db', 'stored role is missing; no permissions granted');
    warning.mockRestore();
  });

  it.each(['null', '{}', '"settings:write"', '[1]', '["unknown:permission"]', 'broken-json'])(
    'fails closed for invalid permissions %s without echoing stored data',
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
