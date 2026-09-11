import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '@app/api/app.js';
import { SESSION_COOKIE_NAME } from '@lib/types/api.js';
import type { Customer } from '@lib/types/auth.js';
import {
  createCustomer,
  findCustomerById,
  initDb,
  insertSession,
  linkIdentity,
  runMigrations,
} from '@lib/services/db/index.js';
import { hashSessionToken } from '@lib/utils/sessionToken.js';

vi.hoisted(() => {
  process.env.GOOGLE_OAUTH_CLIENT_ID ??= 'test-client-id';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= 'test-client-secret';
  process.env.GOOGLE_OAUTH_REDIRECT_URI ??= 'http://localhost:5002/api/auth/google/callback';
});

const app = createApp();
const SESSION_TOKEN = 'auth-route-session-token';
let customer: Customer;
let tempDirectory: string;

function signedIn(token: string = SESSION_TOKEN): RequestInit {
  return { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } };
}

beforeAll(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-auth-route-'));
  initDb(path.join(tempDirectory, 'library.sqlite'));
  runMigrations();

  customer = createCustomer({ email: 'owner@example.com', name: 'Owner' });
  linkIdentity({
    customerId: customer.id,
    provider: 'google',
    providerAccountId: 'sub-owner',
    channelId: 'UCtest_channel',
  });
  customer = findCustomerById(customer.id)!;
  insertSession(hashSessionToken(SESSION_TOKEN), customer.id, Date.now() + 60_000);
});

afterAll(() => {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('auth routes', () => {
  it('returns the customer, channel, role and permissions behind the session', async () => {
    const response = await app.request('/api/me', signedIn());
    expect(response.status).toBe(200);

    const body = (await response.json()) as { customer: Customer };
    expect(body.customer).toMatchObject({
      id: customer.id,
      channelId: 'UCtest_channel',
      role: 'customer',
      permissions: [],
    });
  });

  it('signs out by deleting the server session and clearing the cookie', async () => {
    const token = 'signout-token';
    insertSession(hashSessionToken(token), customer.id, Date.now() + 60_000);

    const response = await app.request('/api/auth/signout', {
      method: 'POST',
      ...signedIn(token),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie') ?? '').toContain(`${SESSION_COOKIE_NAME}=;`);
    expect((await app.request('/api/me', signedIn(token))).status).toBe(401);
  });

  it('allows an anonymous stale tab to sign out', async () => {
    expect((await app.request('/api/auth/signout', { method: 'POST' })).status).toBe(200);
  });

  it('starts configured Google sign-in with a redirect instead of an error response', async () => {
    const response = await app.request('/api/auth/google/start');
    expect(response.status).toBe(302);

    const location = response.headers.get('location') ?? '';
    expect(
      location.startsWith('https://accounts.google.com/') ||
        location === '/login?error=not_configured',
    ).toBe(true);
  });

  it('rejects a callback whose state does not match the handshake cookie', async () => {
    const response = await app.request('/api/auth/google/callback?code=x&state=forged', {
      headers: { cookie: 'vc_login_state=real; vc_login_verifier=v' },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login?error=state_mismatch');
  });

  it('sanitizes an error returned by the provider', async () => {
    const response = await app.request('/api/auth/google/callback?error=access_denied');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      '/login?error=provider_denied&detail=access_denied',
    );
  });

  it.each([
    ['https', true],
    ['http', false],
  ] as const)(
    'sets Secure on handshake cookies when forwarded protocol is %s',
    async (protocol, secure) => {
      const response = await app.request('/api/auth/google/start', {
        headers: { 'x-forwarded-proto': protocol },
      });
      expect(response.status).toBe(302);

      const cookies = response.headers.getSetCookie();
      expect(cookies.length).toBeGreaterThan(0);
      for (const cookie of cookies) {
        if (secure) expect(cookie).toContain('Secure');
        else expect(cookie).not.toContain('Secure');
      }
    },
  );
});
