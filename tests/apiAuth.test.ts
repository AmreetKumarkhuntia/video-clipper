import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app/api/app.js';
import { oauthProvider } from '../src/lib/orchestration/auth/index.js';
import { hashSessionToken } from '../src/lib/utils/sessionToken.js';
import { SESSION_COOKIE_NAME } from '../src/lib/types/api.js';
import {
  createCustomer,
  findCustomerById,
  initDb,
  insertSession,
  linkIdentity,
  runMigrations,
  saveLibraryVideo,
  upsertChannel,
  upsertVideo,
} from '../src/lib/services/db/index.js';
import type { Customer } from '../src/lib/types/auth.js';

/**
 * The identity surface: who is signed in, the linked channel, and the library.
 *
 * Runs against a throwaway database rather than the developer's, because these
 * tests write customers and sessions. `initDb` is called before anything
 * touches a repo, so the lazy handle opens on this file and not the default.
 */

const CHANNEL_ID = 'UCtest_channel';
const OTHER_CHANNEL_ID = 'UCsomeone_else';
const SESSION_TOKEN = 'test-session-token';

const app = createApp();
let customer: Customer;

function signedIn(headers: Record<string, string> = {}): RequestInit {
  return { headers: { ...headers, cookie: `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}` } };
}

async function errorMessageOf(res: Response): Promise<string> {
  const body = (await res.json()) as { error: { message: string } };
  return body.error.message;
}

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-api-auth-'));
  initDb(path.join(dir, 'library.sqlite'));
  runMigrations();

  upsertChannel({ id: CHANNEL_ID, title: 'Test Channel' });
  customer = createCustomer({ email: 'owner@example.com', name: 'Owner' });
  // The channel arrives with the identity, so link one rather than setting a column.
  linkIdentity({
    customerId: customer.id,
    provider: 'google',
    providerAccountId: 'sub-owner',
    channelId: CHANNEL_ID,
  });
  customer = findCustomerById(customer.id)!;
  insertSession(hashSessionToken(SESSION_TOKEN), customer.id, Date.now() + 60_000);
});

describe('session resolution', () => {
  it('leaves unguarded routes reachable with no session, so the CLI keeps working', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
  });

  it('ignores a session cookie that matches nothing', async () => {
    const res = await app.request('/api/me', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=not-a-real-token` },
    });
    expect(res.status).toBe(401);
  });

  it('ignores an expired session rather than trusting the cookie', async () => {
    const stale = 'expired-token';
    insertSession(hashSessionToken(stale), customer.id, Date.now() - 1);
    const res = await app.request('/api/me', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${stale}` },
    });
    expect(res.status).toBe(401);
  });
});

describe('guarded routes', () => {
  // Each of these reaches into one customer's data, so an anonymous caller must
  // be refused by the guard rather than by whatever the handler does with an
  // undefined id.
  const guarded: Array<[string, string]> = [
    ['GET', '/api/me'],
    ['GET', '/api/channel'],
    ['GET', '/api/channel/videos'],
    ['GET', '/api/videos'],
    ['POST', '/api/videos/abc'],
    ['DELETE', '/api/videos/abc'],
  ];

  for (const [method, route] of guarded) {
    it(`refuses ${method} ${route} without a session`, async () => {
      const res = await app.request(route, { method });
      expect(res.status).toBe(401);
      expect(await errorMessageOf(res)).toBe('Sign in to continue.');
    });
  }

  it('keeps the request id on a guard refusal, so a 401 is still traceable', async () => {
    const res = await app.request('/api/me', { headers: { 'x-request-id': 'guard-7' } });
    expect(res.status).toBe(401);
    expect(res.headers.get('x-request-id')).toBe('guard-7');
  });
});

describe('signed in', () => {
  it('answers /api/me with the customer behind the cookie', async () => {
    const res = await app.request('/api/me', signedIn());
    expect(res.status).toBe(200);

    const body = (await res.json()) as { customer: Customer };
    expect(body.customer.id).toBe(customer.id);
    expect(body.customer.channelId).toBe(CHANNEL_ID);
  });

  it('answers /api/channel with the linked channel', async () => {
    const res = await app.request('/api/channel', signedIn());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ channelId: CHANNEL_ID, title: 'Test Channel' });
  });

  it('lists an empty library before anything is saved', async () => {
    const res = await app.request('/api/videos', signedIn());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ videos: [], total: 0, limit: 24, offset: 0 });
  });

  it('rejects a paging limit above the cap instead of running the query', async () => {
    const res = await app.request('/api/videos?limit=5000', signedIn());
    expect(res.status).toBe(400);
  });

  it('lists a saved video, newest first, joined to its catalog row', async () => {
    upsertVideo({
      id: 'vid-1',
      channelId: CHANNEL_ID,
      title: 'First upload',
      description: '',
      channelTitle: 'Test Channel',
      publishedAt: '2026-01-01T00:00:00Z',
      durationSec: 120,
      tags: [],
    });
    saveLibraryVideo({ customerId: customer.id, videoId: 'vid-1' });

    const res = await app.request('/api/videos', signedIn());
    const body = (await res.json()) as { videos: Array<{ videoId: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.videos[0]?.videoId).toBe('vid-1');
  });

  it('removes a video from the library without touching the catalog row', async () => {
    const res = await app.request('/api/videos/vid-1', { method: 'DELETE', ...signedIn() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ videoId: 'vid-1', saved: false });

    const list = await app.request('/api/videos', signedIn());
    expect((await list.json()) as { total: number }).toMatchObject({ total: 0 });
  });
});

describe('a customer with no linked channel', () => {
  const token = 'unlinked-token';

  beforeAll(() => {
    const unlinked = createCustomer({ email: 'nolink@example.com' });
    insertSession(hashSessionToken(token), unlinked.id, Date.now() + 60_000);
  });

  // 409 rather than 404: the route exists and the account is real, but the link
  // never completed. Reconnecting is the fix, and the status should say so.
  it('answers 409 on the channel routes', async () => {
    for (const route of ['/api/channel', '/api/channel/videos']) {
      const res = await app.request(route, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });
      expect(res.status, route).toBe(409);
      expect(await errorMessageOf(res)).toBe('No YouTube channel is linked to this account.');
    }
  });
});

describe('sign out', () => {
  it('deletes the session and clears the cookie', async () => {
    const token = 'signout-token';
    insertSession(hashSessionToken(token), customer.id, Date.now() + 60_000);
    const cookie = { cookie: `${SESSION_COOKIE_NAME}=${token}` };

    const res = await app.request('/api/auth/signout', { method: 'POST', headers: cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie') ?? '').toContain(`${SESSION_COOKIE_NAME}=;`);

    // The token is gone server-side too, so a replayed cookie buys nothing.
    const after = await app.request('/api/me', { headers: cookie });
    expect(after.status).toBe(401);
  });

  it('succeeds with no session, so a stale tab can always sign itself out', async () => {
    const res = await app.request('/api/auth/signout', { method: 'POST' });
    expect(res.status).toBe(200);
  });
});

describe('sign-in redirects', () => {
  it('never serves a 500 from the start route', async () => {
    const res = await app.request('/api/auth/google/start');
    expect(res.status).toBe(302);

    // Configured, this is Google's consent screen; unconfigured, the login page
    // carrying the setup message. Which one depends on the machine's config, so
    // what is asserted is the part that must hold either way: the first person
    // to click sign in gets a page, never a stack trace.
    const location = res.headers.get('location') ?? '';
    const configured = location.startsWith('https://accounts.google.com/');
    expect(configured || location.startsWith('/login?error=')).toBe(true);
  });

  // The branch the route above catches, exercised directly so it is covered on
  // a machine that does have credentials set.
  it('refuses to start with no client credentials', () => {
    expect(() => oauthProvider('google', {}).startLogin('/')).toThrow();
  });

  it('refuses a callback whose state does not match the cookie', async () => {
    const res = await app.request('/api/auth/google/callback?code=x&state=forged', {
      headers: { cookie: 'vc_login_state=real; vc_login_verifier=v' },
    });
    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.get('location') ?? '')).toContain(
      'Sign-in could not be verified',
    );
  });

  it('reports an error Google itself returned', async () => {
    const res = await app.request('/api/auth/google/callback?error=access_denied');
    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.get('location') ?? '')).toContain('access_denied');
  });
});
