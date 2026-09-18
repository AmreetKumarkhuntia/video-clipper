import { afterAll, beforeAll, describe, it, expect, beforeEach, vi } from 'vitest';
import { Client } from 'pg';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../support/postgres.js';
import type { GoogleUserInfo, OwnedYouTubeChannel, SignInResult } from '@lib/types/auth.js';

// ── Stub the Google HTTP calls; keep the real crypto helpers ─────────────────

const googleState = {
  sub: 'sub-a',
  email: 'a@example.com',
  emailVerified: true,
  channel: { channelId: 'UC_a', title: 'Channel A' } as { channelId: string; title: string } | null,
  refreshToken: 'refresh-1' as string | undefined,
};
const googleProfiles = new Map<string, GoogleUserInfo>();
const googleChannels = new Map<string, OwnedYouTubeChannel | null>();

vi.mock('@lib/utils/googleOAuth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lib/utils/googleOAuth.js')>();
  return {
    ...actual,
    exchangeGoogleCode: vi.fn(async (code: string) => ({
      access_token: code === 'code' ? 'access-1' : `access-${code}`,
      refresh_token: googleState.refreshToken,
      expires_in: 3600,
      scope: 'openid https://www.googleapis.com/auth/youtube.readonly',
    })),
    fetchGoogleUserInfo: vi.fn(
      async (accessToken: string) =>
        googleProfiles.get(accessToken) ?? {
          sub: googleState.sub,
          email: googleState.email,
          email_verified: googleState.emailVerified,
        },
    ),
    fetchOwnedYouTubeChannel: vi.fn(async (accessToken: string) =>
      googleChannels.has(accessToken) ? googleChannels.get(accessToken)! : googleState.channel,
    ),
  };
});

const { oauthProvider, resolveSession, signOut } = await import('@lib/orchestration/auth/index.js');
const { hashSessionToken } = await import('@lib/utils/sessionToken.js');
const { findIdentity } = await import('@lib/services/db/repos/authIdentitiesRepo.js');

/** The lifetime the app would pass in; the provider no longer owns it. */
const SESSION = { sessionTtlMs: 30 * 24 * 60 * 60 * 1000 };

const OAUTH = {
  clientId: 'client',
  clientSecret: 'secret',
  redirectUri: 'http://localhost:5002/api/auth/google/callback',
};
const HANDSHAKE = { state: 's', codeVerifier: 'v', returnTo: '/' };

const google = () => oauthProvider('google', OAUTH);
let database: PostgresTestDatabase;

async function customerCount(): Promise<number> {
  const result = await database.query<{ count: string }>('select count(*) from customers');
  return Number(result.rows[0]?.count ?? 0);
}

function setGoogleAccount(
  code: string,
  accountId: string,
  email: string,
  channelId: string,
  channelTitle: string,
): void {
  const accessToken = `access-${code}`;
  googleProfiles.set(accessToken, {
    sub: accountId,
    email,
    email_verified: true,
  });
  googleChannels.set(accessToken, { channelId, title: channelTitle });
}

async function waitForInitialAdminWaiters(expected: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await database.query<{ count: string }>(`
      select count(*)::text as count
      from pg_stat_activity
      where datname = current_database()
        and lower(coalesce(wait_event, '')) = 'advisory'
        and query like '%video-clipper-initial-admin%'
    `);
    if (Number(result.rows[0]?.count ?? 0) >= expected) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${expected} initial-admin advisory-lock waiters.`);
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('oauth_provider');
});

beforeEach(async () => {
  await database.reset();
  googleState.sub = 'sub-a';
  googleState.email = 'a@example.com';
  googleState.emailVerified = true;
  googleState.channel = { channelId: 'UC_a', title: 'Channel A' };
  googleState.refreshToken = 'refresh-1';
  googleProfiles.clear();
  googleChannels.clear();
});

afterAll(async () => database.close());

describe('startLogin', () => {
  it('mints a fresh handshake and an auth url carrying its state', () => {
    const first = google().startLogin('/browse');
    const second = google().startLogin('/browse');

    expect(first.handshake.state).not.toBe(second.handshake.state);
    expect(first.handshake.returnTo).toBe('/browse');
    expect(first.authUrl).toContain(encodeURIComponent(first.handshake.state));
    expect(first.authUrl).not.toContain(first.handshake.codeVerifier);
  });
});

describe('completeLogin', () => {
  it('creates the customer, links the channel, stores tokens, and opens a session', async () => {
    const result = await google().completeLogin('code', HANDSHAKE, SESSION);

    expect(result.customer.channelId).toBe('UC_a');
    expect(result.customer.email).toBe('a@example.com');
    // The provider id lives on the identity row, never on the customer.
    expect(result.customer).not.toHaveProperty('googleSub');
    const identity = await database.query<{ provider: string; sub: string }>(
      'select provider, provider_account_id as sub from auth_identities',
    );
    expect(identity.rows[0]).toEqual({ provider: 'google', sub: 'sub-a' });
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect((await findIdentity(result.customer.id, 'google'))?.refreshToken).toBe('refresh-1');
    expect((await resolveSession(result.token))?.id).toBe(result.customer.id);
  });

  it('keeps the channel and the tokens on the identity, not on the customer', async () => {
    const result = await google().completeLogin('code', HANDSHAKE, SESSION);
    const identity = await findIdentity(result.customer.id, 'google');

    expect(identity?.channelId).toBe('UC_a');
    expect(identity?.accessToken).toBe('access-1');
    // `Customer.channelId` is read back through the identity, so both agree.
    expect(result.customer.channelId).toBe(identity?.channelId);
  });

  it('registers the linked channel so its title is available without an api call', async () => {
    await google().completeLogin('code', HANDSHAKE, SESSION);
    const row = await database.query<{ title: string }>(
      'select title from channels where id = $1',
      ['UC_a'],
    );
    expect(row.rows[0]?.title).toBe('Channel A');
  });

  it('signing in again reuses the customer and keeps the first refresh token', async () => {
    const first = await google().completeLogin('code', HANDSHAKE, SESSION);
    googleState.refreshToken = undefined;
    const second = await google().completeLogin('code', HANDSHAKE, SESSION);

    expect(second.customer.id).toBe(first.customer.id);
    expect(await customerCount()).toBe(1);
    expect((await findIdentity(second.customer.id, 'google'))?.refreshToken).toBe('refresh-1');
    expect(second.token).not.toBe(first.token);
  });

  it('serializes a concurrent claim for the same provider account without leaving an orphan', async () => {
    await database.query(`
      create function oauth_test_delay_customer_insert() returns trigger
      language plpgsql as $$
      begin
        perform pg_sleep(0.2);
        return new;
      end;
      $$
    `);
    await database.query(`
      create trigger oauth_test_delay_customer_insert
      before insert on customers
      for each row execute function oauth_test_delay_customer_insert()
    `);

    setGoogleAccount('same-account-a', 'shared-sub', 'shared@example.com', 'UC_shared', 'Shared');
    setGoogleAccount('same-account-b', 'shared-sub', 'shared@example.com', 'UC_shared', 'Shared');

    let settled: PromiseSettledResult<SignInResult>[] = [];
    try {
      settled = await Promise.allSettled([
        google().completeLogin('same-account-a', HANDSHAKE, SESSION),
        google().completeLogin('same-account-b', HANDSHAKE, SESSION),
      ]);
    } finally {
      await database.query('drop trigger oauth_test_delay_customer_insert on customers');
      await database.query('drop function oauth_test_delay_customer_insert()');
    }

    expect(settled[0].status).toBe('fulfilled');
    expect(settled[1].status).toBe('fulfilled');
    if (settled[0].status !== 'fulfilled' || settled[1].status !== 'fulfilled') {
      throw new Error('Both concurrent sign-ins should succeed.');
    }
    expect(settled[0].value.customer.id).toBe(settled[1].value.customer.id);
    expect(await customerCount()).toBe(1);
    const identityCount = await database.query<{ count: string }>(
      'select count(*)::text as count from auth_identities',
    );
    const sessionCount = await database.query<{ count: string }>(
      'select count(*)::text as count from sessions',
    );
    expect(Number(identityCount.rows[0]?.count ?? 0)).toBe(1);
    expect(Number(sessionCount.rows[0]?.count ?? 0)).toBe(2);
  });

  it('retires the session it was presented with, so signing in again rotates it', async () => {
    const first = await google().completeLogin('code', HANDSHAKE, SESSION);
    const second = await google().completeLogin('code', HANDSHAKE, {
      ...SESSION,
      replacesToken: first.token,
    });

    expect(await resolveSession(first.token)).toBeNull();
    expect((await resolveSession(second.token))?.id).toBe(first.customer.id);
  });

  it('ignores a presented token that is already dead', async () => {
    const result = await google().completeLogin('code', HANDSHAKE, {
      ...SESSION,
      replacesToken: 'long-gone',
    });
    expect((await resolveSession(result.token))?.id).toBe(result.customer.id);
  });

  it('bootstraps only the configured verified Google email as administrator', async () => {
    const result = await google().completeLogin('code', HANDSHAKE, {
      ...SESSION,
      initialAdminEmail: 'A@EXAMPLE.COM',
    });

    expect(result.customer.role).toBe('admin');
    expect(result.customer.permissions).toContain('settings:write');
  });

  it('does not bootstrap an unverified or different email', async () => {
    googleState.emailVerified = false;
    const unverified = await google().completeLogin('code', HANDSHAKE, {
      ...SESSION,
      initialAdminEmail: 'a@example.com',
    });
    expect(unverified.customer.role).toBe('customer');

    googleState.sub = 'sub-b';
    googleState.email = 'b@example.com';
    googleState.channel = { channelId: 'UC_b', title: 'Channel B' };
    googleState.emailVerified = true;
    const different = await google().completeLogin('code', HANDSHAKE, {
      ...SESSION,
      initialAdminEmail: 'admin@example.com',
    });
    expect(different.customer.role).toBe('customer');
  });

  it('does not bootstrap another administrator while one already exists', async () => {
    const first = await google().completeLogin('code', HANDSHAKE, {
      ...SESSION,
      initialAdminEmail: 'a@example.com',
    });
    expect(first.customer.role).toBe('admin');

    googleState.sub = 'sub-b';
    googleState.email = 'b@example.com';
    googleState.channel = { channelId: 'UC_b', title: 'Channel B' };
    const second = await google().completeLogin('code', HANDSHAKE, {
      ...SESSION,
      initialAdminEmail: 'b@example.com',
    });
    expect(second.customer.role).toBe('customer');
  });

  it('serializes truly concurrent initial-administrator decisions', async () => {
    setGoogleAccount('admin-a', 'admin-sub-a', 'bootstrap@example.com', 'UC_admin_a', 'Admin A');
    setGoogleAccount('admin-b', 'admin-sub-b', 'bootstrap@example.com', 'UC_admin_b', 'Admin B');

    const blocker = new Client({ connectionString: database.connectionString });
    await blocker.connect();
    await blocker.query('select pg_advisory_lock(hashtext($1))', ['video-clipper-initial-admin']);
    let released = false;
    const signIns = [
      google().completeLogin('admin-a', HANDSHAKE, {
        ...SESSION,
        initialAdminEmail: 'bootstrap@example.com',
      }),
      google().completeLogin('admin-b', HANDSHAKE, {
        ...SESSION,
        initialAdminEmail: 'bootstrap@example.com',
      }),
    ];

    let results: SignInResult[];
    try {
      await waitForInitialAdminWaiters(2);
      await blocker.query('select pg_advisory_unlock(hashtext($1))', [
        'video-clipper-initial-admin',
      ]);
      released = true;
      results = await Promise.all(signIns);
    } finally {
      if (!released) {
        await blocker.query('select pg_advisory_unlock(hashtext($1))', [
          'video-clipper-initial-admin',
        ]);
      }
      await Promise.allSettled(signIns);
      await blocker.end();
    }

    expect(results.map(({ customer }) => customer.role).sort()).toEqual(['admin', 'customer']);
    const administrators = await database.query<{ id: string }>(
      `select id from customers where role_id = 'admin'`,
    );
    expect(administrators.rows).toHaveLength(1);
    expect(await customerCount()).toBe(2);
  });

  it('rejects an account with no channel and writes nothing', async () => {
    googleState.channel = null;
    await expect(google().completeLogin('code', HANDSHAKE, SESSION)).rejects.toMatchObject({
      code: 'no_channel',
      message: expect.stringMatching(/no YouTube channel/) as string,
    });
    expect(await customerCount()).toBe(0);
  });

  it('rejects a channel already claimed by another account, leaving the first intact', async () => {
    const first = await google().completeLogin('code', HANDSHAKE, SESSION);
    googleState.sub = 'sub-b';

    await expect(google().completeLogin('code', HANDSHAKE, SESSION)).rejects.toMatchObject({
      code: 'channel_claimed',
      detail: 'Channel A',
      message: expect.stringMatching(/already linked to another account/) as string,
    });
    expect(await customerCount()).toBe(1);
    expect((await resolveSession(first.token))?.id).toBe(first.customer.id);
  });

  it('maps a concurrent partial channel uniqueness conflict to channel_claimed', async () => {
    setGoogleAccount('channel-a', 'channel-sub-a', 'a@example.com', 'UC_race', 'Race Channel');
    setGoogleAccount('channel-b', 'channel-sub-b', 'b@example.com', 'UC_race', 'Race Channel');

    const settled = await Promise.allSettled([
      google().completeLogin('channel-a', HANDSHAKE, SESSION),
      google().completeLogin('channel-b', HANDSHAKE, SESSION),
    ]);
    const successes = settled.filter(({ status }) => status === 'fulfilled');
    const failures = settled.filter(({ status }) => status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      reason: {
        code: 'channel_claimed',
        detail: 'Race Channel',
      },
    });
    expect(await customerCount()).toBe(1);
  });

  it('does not misclassify an unrelated unique violation as a channel claim', async () => {
    await database.query(
      'alter table customers add constraint oauth_customers_email_uq unique (email)',
    );
    await database.query(
      `insert into customers (id, email, role_id, created_at, updated_at)
       values ('customer-existing', 'a@example.com', 'customer', now(), now())`,
    );

    try {
      await expect(google().completeLogin('code', HANDSHAKE, SESSION)).rejects.not.toMatchObject({
        code: 'channel_claimed',
      });
    } finally {
      await database.query('alter table customers drop constraint oauth_customers_email_uq');
    }

    expect(await customerCount()).toBe(1);
    const identities = await database.query<{ id: string }>('select id from auth_identities');
    expect(identities.rows).toHaveLength(0);
  });

  it('rejects an account whose channel has changed', async () => {
    await google().completeLogin('code', HANDSHAKE, SESSION);
    googleState.channel = { channelId: 'UC_other', title: 'Other Channel' };

    await expect(google().completeLogin('code', HANDSHAKE, SESSION)).rejects.toMatchObject({
      code: 'channel_mismatch',
      message: expect.stringMatching(/already linked to a different channel/) as string,
    });
    expect(await customerCount()).toBe(1);
  });
});

describe('resolveSession and signOut', () => {
  it('rejects an unknown or absent token', async () => {
    expect(await resolveSession(undefined)).toBeNull();
    expect(await resolveSession('not-a-token')).toBeNull();
  });

  it('stores only the hash of the token', async () => {
    const { token } = await google().completeLogin('code', HANDSHAKE, SESSION);
    const stored = await database.query<{ id: string }>('select id from sessions');

    expect(stored.rows[0]?.id).toBe(hashSessionToken(token));
    expect(stored.rows.some((row) => row.id === token)).toBe(false);
  });

  it('signing out invalidates the session', async () => {
    const { token } = await google().completeLogin('code', HANDSHAKE, SESSION);
    await signOut(token);
    expect(await resolveSession(token)).toBeNull();
  });
});
