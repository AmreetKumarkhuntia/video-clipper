import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from '../src/lib/services/db/schema.js';

// ── In-memory DB setup ────────────────────────────────────────────────────────

const sqlite = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

vi.mock('../src/lib/services/db/client.js', () => ({ db: testDb }));

// ── Stub the Google HTTP calls; keep the real crypto helpers ─────────────────

const googleState = {
  sub: 'sub-a',
  channel: { channelId: 'UC_a', title: 'Channel A' } as { channelId: string; title: string } | null,
  refreshToken: 'refresh-1' as string | undefined,
};

vi.mock('../src/lib/utils/googleOAuth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/utils/googleOAuth.js')>();
  return {
    ...actual,
    exchangeGoogleCode: vi.fn(async () => ({
      access_token: 'access-1',
      refresh_token: googleState.refreshToken,
      expires_in: 3600,
      scope: 'openid https://www.googleapis.com/auth/youtube.readonly',
    })),
    fetchGoogleUserInfo: vi.fn(async () => ({ sub: googleState.sub, email: 'a@example.com' })),
    fetchOwnedYouTubeChannel: vi.fn(async () => googleState.channel),
  };
});

const { oauthProvider, resolveSession, signOut } =
  await import('../src/lib/orchestration/auth/index.js');
const { hashSessionToken } = await import('../src/lib/utils/sessionToken.js');
const { findIdentity } = await import('../src/lib/services/db/repos/authIdentitiesRepo.js');

/** The lifetime the app would pass in; the provider no longer owns it. */
const SESSION = { sessionTtlMs: 30 * 24 * 60 * 60 * 1000 };

const OAUTH = {
  clientId: 'client',
  clientSecret: 'secret',
  redirectUri: 'http://localhost:5002/api/auth/google/callback',
};
const HANDSHAKE = { state: 's', codeVerifier: 'v', returnTo: '/' };

const google = () => oauthProvider('google', OAUTH);

function customerCount(): number {
  return (sqlite.prepare('SELECT COUNT(*) AS n FROM customers').get() as { n: number }).n;
}

beforeEach(() => {
  sqlite.exec('DELETE FROM sessions; DELETE FROM auth_identities; DELETE FROM customers;');
  googleState.sub = 'sub-a';
  googleState.channel = { channelId: 'UC_a', title: 'Channel A' };
  googleState.refreshToken = 'refresh-1';
});

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
    const identity = sqlite
      .prepare('SELECT provider, provider_account_id AS sub FROM auth_identities')
      .get() as { provider: string; sub: string };
    expect(identity).toEqual({ provider: 'google', sub: 'sub-a' });
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(findIdentity(result.customer.id, 'google')?.refreshToken).toBe('refresh-1');
    expect(resolveSession(result.token)?.id).toBe(result.customer.id);
  });

  it('keeps the channel and the tokens on the identity, not on the customer', async () => {
    const result = await google().completeLogin('code', HANDSHAKE, SESSION);
    const identity = findIdentity(result.customer.id, 'google');

    expect(identity?.channelId).toBe('UC_a');
    expect(identity?.accessToken).toBe('access-1');
    // `Customer.channelId` is read back through the identity, so both agree.
    expect(result.customer.channelId).toBe(identity?.channelId);
  });

  it('registers the linked channel so its title is available without an api call', async () => {
    await google().completeLogin('code', HANDSHAKE, SESSION);
    const row = sqlite.prepare('SELECT title FROM channels WHERE id = ?').get('UC_a') as
      | { title: string }
      | undefined;
    expect(row?.title).toBe('Channel A');
  });

  it('signing in again reuses the customer and keeps the first refresh token', async () => {
    const first = await google().completeLogin('code', HANDSHAKE, SESSION);
    googleState.refreshToken = undefined;
    const second = await google().completeLogin('code', HANDSHAKE, SESSION);

    expect(second.customer.id).toBe(first.customer.id);
    expect(customerCount()).toBe(1);
    expect(findIdentity(second.customer.id, 'google')?.refreshToken).toBe('refresh-1');
    expect(second.token).not.toBe(first.token);
  });

  it('rejects an account with no channel and writes nothing', async () => {
    googleState.channel = null;
    await expect(google().completeLogin('code', HANDSHAKE, SESSION)).rejects.toThrow(
      /no YouTube channel/,
    );
    expect(customerCount()).toBe(0);
  });

  it('rejects a channel already claimed by another account, leaving the first intact', async () => {
    const first = await google().completeLogin('code', HANDSHAKE, SESSION);
    googleState.sub = 'sub-b';

    await expect(google().completeLogin('code', HANDSHAKE, SESSION)).rejects.toThrow(
      /already linked to another account/,
    );
    expect(customerCount()).toBe(1);
    expect(resolveSession(first.token)?.id).toBe(first.customer.id);
  });

  it('rejects an account whose channel has changed', async () => {
    await google().completeLogin('code', HANDSHAKE, SESSION);
    googleState.channel = { channelId: 'UC_other', title: 'Other Channel' };

    await expect(google().completeLogin('code', HANDSHAKE, SESSION)).rejects.toThrow(
      /already linked to a different channel/,
    );
    expect(customerCount()).toBe(1);
  });
});

describe('resolveSession and signOut', () => {
  it('rejects an unknown or absent token', () => {
    expect(resolveSession(undefined)).toBeNull();
    expect(resolveSession('not-a-token')).toBeNull();
  });

  it('stores only the hash of the token', async () => {
    const { token } = await google().completeLogin('code', HANDSHAKE, SESSION);
    const stored = sqlite.prepare('SELECT id FROM sessions').all() as { id: string }[];

    expect(stored[0]?.id).toBe(hashSessionToken(token));
    expect(stored.some((r) => r.id === token)).toBe(false);
  });

  it('signing out invalidates the session', async () => {
    const { token } = await google().completeLogin('code', HANDSHAKE, SESSION);
    signOut(token);
    expect(resolveSession(token)).toBeNull();
  });
});
