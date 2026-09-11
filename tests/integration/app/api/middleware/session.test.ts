import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '@app/api/app.js';
import { SESSION_COOKIE_NAME } from '@lib/types/api.js';
import { createCustomer, initDb, insertSession, runMigrations } from '@lib/services/db/index.js';
import { hashSessionToken } from '@lib/utils/sessionToken.js';

const app = createApp();
const SESSION_TOKEN = 'middleware-session-token';
let tempDirectory: string;
let customerId: string;

async function errorMessageOf(response: Response): Promise<string> {
  const body = (await response.json()) as { error: { message: string } };
  return body.error.message;
}

beforeAll(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-session-middleware-'));
  initDb(path.join(tempDirectory, 'library.sqlite'));
  runMigrations();

  const customer = createCustomer({ email: 'owner@example.com' });
  customerId = customer.id;
  insertSession(hashSessionToken(SESSION_TOKEN), customer.id, Date.now() + 60_000);
});

afterAll(() => {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('session middleware', () => {
  it('leaves unguarded routes reachable without a session', async () => {
    expect((await app.request('/api/health')).status).toBe(200);
  });

  it('rejects unknown and expired session cookies', async () => {
    const unknown = await app.request('/api/me', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=not-a-real-token` },
    });
    expect(unknown.status).toBe(401);

    const stale = 'expired-token';
    insertSession(hashSessionToken(stale), customerId, Date.now() - 1);
    const expired = await app.request('/api/me', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${stale}` },
    });
    expect(expired.status).toBe(401);
  });

  it('accepts a valid bearer session used by the CLI', async () => {
    const response = await app.request('/api/me', {
      headers: { authorization: `Bearer ${SESSION_TOKEN}` },
    });
    expect(response.status).toBe(200);
  });

  it('lets a bearer header take precedence over a browser cookie', async () => {
    const response = await app.request('/api/me', {
      headers: {
        authorization: 'Bearer not-a-real-token',
        cookie: `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`,
      },
    });
    expect(response.status).toBe(401);
  });

  const guardedRoutes: Array<[string, string]> = [
    ['GET', '/api/me'],
    ['GET', '/api/channel'],
    ['GET', '/api/channel/videos'],
    ['GET', '/api/videos'],
    ['POST', '/api/videos/abc'],
    ['DELETE', '/api/videos/abc'],
    ['PATCH', '/api/settings'],
  ];

  it.each(guardedRoutes)('refuses anonymous %s %s', async (method, route) => {
    const response = await app.request(route, { method });
    expect(response.status).toBe(401);
    expect(await errorMessageOf(response)).toBe('Sign in to continue.');
  });

  it('preserves the request id on an authentication failure', async () => {
    const response = await app.request('/api/me', {
      headers: { 'x-request-id': 'guard-7' },
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toBe('guard-7');
  });
});
