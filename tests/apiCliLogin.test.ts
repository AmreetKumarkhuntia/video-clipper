import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from '../src/lib/services/db/schema.js';
import { setConfigValues } from '../src/lib/config/index.js';
import { createCodeChallenge, exchangeGoogleCode } from '../src/lib/utils/googleOAuth.js';
import { CLI } from '../src/lib/utils/constants.js';
import { resolveClientAddress } from '../src/app/api/services/clientAddress.js';
import { LOGIN_STATE_COOKIE, LOGIN_VERIFIER_COOKIE } from '../src/app/api/http/sessionCookies.js';
import {
  CliLoginExchangeResponseSchema,
  CliLoginStartResponseSchema,
  SESSION_COOKIE_NAME,
} from '../src/lib/types/api.js';
import type {
  CliLoginExchangeRequest,
  CliLoginStartRequest,
  CliLoginStartResponse,
} from '../src/lib/types/api.js';

vi.hoisted(() => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-cli-client';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-cli-secret';
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:5002/api/auth/google/callback';
  delete process.env.INITIAL_ADMIN_EMAIL;
});

// The provider, orchestration, database and sessions are real; only Google HTTP is stubbed.
vi.mock('../src/lib/utils/googleOAuth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/utils/googleOAuth.js')>();
  return {
    ...actual,
    exchangeGoogleCode: vi.fn(),
    fetchGoogleUserInfo: vi.fn(async () => ({
      sub: 'cli-owner-sub',
      email: 'owner@example.com',
      email_verified: true,
    })),
    fetchOwnedYouTubeChannel: vi.fn(async () => ({
      channelId: 'UC_cli_owner',
      title: 'Owner channel',
    })),
  };
});
const sqlite = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
vi.mock('../src/lib/services/db/client.js', () => ({ db: testDb }));
const { createApp } = await import('../src/app/api/app.js');

const VERIFIER = 'v'.repeat(43);
const INPUT: CliLoginStartRequest = {
  redirectUri: 'http://127.0.0.1:43123/callback',
  state: 's'.repeat(43),
  codeChallenge: createCodeChallenge(VERIFIER),
  codeChallengeMethod: 'S256',
};
const GOOGLE_TOKENS = {
  access_token: 'google-access-secret',
  refresh_token: 'google-refresh-secret',
};
let app = createApp();

function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}
function cookiesOf(response: Response): Record<string, string> {
  return Object.fromEntries(
    response.headers.getSetCookie().map((header) => {
      const pair = header.split(';')[0]!;
      const separator = pair.indexOf('=');
      return [pair.slice(0, separator), pair.slice(separator + 1)];
    }),
  );
}
function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}
function location(response: Response): URL {
  expect(response.status).toBe(302);
  return new URL(response.headers.get('location')!, 'http://localhost:5002');
}
async function start(
  input: CliLoginStartRequest = INPUT,
  headers: Record<string, string> = {},
): Promise<CliLoginStartResponse> {
  const response = await app.request('/api/auth/cli/start', json(input, headers));
  expect(response.status).toBe(200);
  return CliLoginStartResponseSchema.parse(await response.json());
}
async function begin(input: CliLoginStartRequest = INPUT): Promise<Response> {
  const started = await start(input);
  const response = await app.request(started.authorizationUrl);
  expect(response.status).toBe(302);
  return response;
}
async function callback(
  authorization: Response,
  query: Record<string, string> = {},
  cookies: Record<string, string> = cookiesOf(authorization),
  target: ReturnType<typeof createApp> = app,
): Promise<Response> {
  const params = new URLSearchParams({
    code: 'google-code',
    state: location(authorization).searchParams.get('state')!,
    ...query,
  });
  return target.request(`/api/auth/google/callback?${params}`, {
    headers: { cookie: cookieHeader(cookies) },
  });
}
async function grant(): Promise<Response> {
  const response = await callback(await begin());
  expect(location(response).searchParams.has('code')).toBe(true);
  return response;
}
async function exchange(
  response: Response,
  overrides: Partial<CliLoginExchangeRequest> = {},
  target: ReturnType<typeof createApp> = app,
): Promise<Response> {
  return target.request(
    '/api/auth/cli/exchange',
    json({
      code: location(response).searchParams.get('code'),
      codeVerifier: VERIFIER,
      redirectUri: INPUT.redirectUri,
      ...overrides,
    }),
  );
}
async function me(token: string, target: ReturnType<typeof createApp> = app): Promise<Response> {
  return target.request('/api/me', { headers: { authorization: `Bearer ${token}` } });
}
function sessionCount(): number {
  return sqlite.prepare('SELECT COUNT(*) FROM sessions').pluck().get() as number;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(exchangeGoogleCode).mockResolvedValue(GOOGLE_TOKENS);
  sqlite.exec(
    'DELETE FROM sessions; DELETE FROM auth_identities; DELETE FROM customers; DELETE FROM channels;',
  );
  setConfigValues({
    CLI_LOGIN_RATE_LIMIT_REQUESTS: 100,
    CLI_LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
    CLI_LOGIN_MAX_OUTSTANDING: 100,
    TRUSTED_PROXY_HOPS: 1,
  });
  app = createApp();
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => sqlite.close());

describe('browser callback CLI sign-in', () => {
  it('binds a fresh request to browser cookies and Google state without issuing a session', async () => {
    const started = await start();
    expect(started.expiresAt).toBeGreaterThan(Date.now());
    expect(new URL(started.authorizationUrl).origin).toBe('http://localhost:5002');
    const authorized = await app.request(started.authorizationUrl);
    const cookies = cookiesOf(authorized);
    const google = location(authorized);
    expect(google.origin).toBe('https://accounts.google.com');
    expect(google.searchParams.get('state')).toBe(cookies[LOGIN_STATE_COOKIE]);
    expect(google.searchParams.get('code_challenge')).toBe(
      createCodeChallenge(cookies[LOGIN_VERIFIER_COOKIE]!),
    );
    expect(cookies[CLI.AUTH.REQUEST_COOKIE]).toBe(
      new URL(started.authorizationUrl).searchParams.get('request'),
    );
    expect(
      authorized.headers
        .getSetCookie()
        .find((value) => value.startsWith(`${CLI.AUTH.REQUEST_COOKIE}=`)),
    ).toMatch(/HttpOnly.*SameSite=Lax/);
    expect(sessionCount()).toBe(0);
    expect((await app.request(started.authorizationUrl)).status).toBe(410);
  });

  it('redirects only an exchange code and caller state, then issues distinct browser and CLI sessions', async () => {
    const authorized = await begin();
    const response = await callback(authorized);
    const redirected = location(response);
    const browserToken = cookiesOf(response)[SESSION_COOKIE_NAME]!;
    expect(`${redirected.origin}${redirected.pathname}`).toBe(INPUT.redirectUri);
    expect([...redirected.searchParams.keys()].sort()).toEqual(['code', 'state']);
    expect(redirected.searchParams.get('state')).toBe(INPUT.state);
    expect(redirected.toString()).not.toContain(browserToken);
    expect(redirected.toString()).not.toContain(GOOGLE_TOKENS.access_token);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(exchangeGoogleCode).toHaveBeenCalledWith(
      'google-code',
      cookiesOf(authorized)[LOGIN_VERIFIER_COOKIE],
      expect.any(Object),
    );
    expect(sessionCount()).toBe(1);
    const redeemed = await exchange(response);
    expect(redeemed.status).toBe(200);
    const result = CliLoginExchangeResponseSchema.parse(await redeemed.json());
    expect(result.token).not.toBe(browserToken);
    expect(redirected.toString()).not.toContain(result.token);
    expect(sessionCount()).toBe(2);
    expect((await me(result.token)).status).toBe(200);
    expect(
      (
        await app.request('/api/me', {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${browserToken}` },
        })
      ).status,
    ).toBe(200);
    expect((await exchange(response)).status).toBe(400);
  });

  it.each(['browser', 'cli'] as const)(
    'signing out the %s session leaves the other session valid',
    async (kind) => {
      const response = await grant();
      const browserToken = cookiesOf(response)[SESSION_COOKIE_NAME]!;
      const result = CliLoginExchangeResponseSchema.parse(await (await exchange(response)).json());
      const outgoing = kind === 'browser' ? browserToken : result.token;
      const retained = kind === 'browser' ? result.token : browserToken;
      const headers: Record<string, string> =
        kind === 'browser'
          ? { cookie: `${SESSION_COOKIE_NAME}=${outgoing}` }
          : { authorization: `Bearer ${outgoing}` };
      expect((await app.request('/api/auth/signout', { method: 'POST', headers })).status).toBe(
        200,
      );
      expect((await me(outgoing)).status).toBe(401);
      expect((await me(retained)).status).toBe(200);
    },
  );

  it('rotates an existing browser session while keeping an older CLI session alive', async () => {
    const first = await grant();
    const oldBrowserToken = cookiesOf(first)[SESSION_COOKIE_NAME]!;
    const oldCli = CliLoginExchangeResponseSchema.parse(await (await exchange(first)).json());
    const authorized = await begin();
    const second = await callback(
      authorized,
      {},
      { ...cookiesOf(authorized), [SESSION_COOKIE_NAME]: oldBrowserToken },
    );
    const newBrowserToken = cookiesOf(second)[SESSION_COOKIE_NAME]!;
    expect(newBrowserToken).not.toBe(oldBrowserToken);
    expect((await me(oldBrowserToken)).status).toBe(401);
    expect((await me(oldCli.token)).status).toBe(200);
    expect((await me(newBrowserToken)).status).toBe(200);
    expect((await exchange(second)).status).toBe(200);
  });

  it('allows exactly one of two concurrent exchanges to mint a session', async () => {
    const response = await grant();
    const results = await Promise.all([exchange(response), exchange(response)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    expect(sessionCount()).toBe(2);
  });

  it('does not consume a grant on an incorrect verifier or redirect', async () => {
    const response = await grant();
    expect((await exchange(response, { codeVerifier: 'w'.repeat(43) })).status).toBe(400);
    expect(
      (await exchange(response, { redirectUri: 'http://127.0.0.1:43124/callback' })).status,
    ).toBe(400);
    expect(sessionCount()).toBe(1);
    expect((await exchange(response)).status).toBe(200);
  });

  it('rejects a grant after its customer is deleted without minting another session', async () => {
    const response = await grant();
    sqlite.exec('DELETE FROM customers');
    expect((await exchange(response)).status).toBe(400);
    expect(sessionCount()).toBe(1);
  });
});

describe('callback request binding', () => {
  it.each([
    'wrong-state',
    'missing-state-cookie',
    'missing-verifier-cookie',
    'unknown-request-cookie',
  ])('refuses %s before contacting Google or following a loopback redirect', async (scenario) => {
    const authorization = await begin();
    const cookies = cookiesOf(authorization);
    const query: Record<string, string> = {};
    if (scenario === 'wrong-state') query.state = 'unrelated-state';
    if (scenario === 'missing-state-cookie') delete cookies[LOGIN_STATE_COOKIE];
    if (scenario === 'missing-verifier-cookie') delete cookies[LOGIN_VERIFIER_COOKIE];
    if (scenario === 'unknown-request-cookie') cookies[CLI.AUTH.REQUEST_COOKIE] = 'unknown-request';
    const response = await callback(authorization, query, cookies);
    expect(location(response).pathname).toBe('/login');
    expect(location(response).searchParams.get('error')).toBe('state_mismatch');
    expect(exchangeGoogleCode).not.toHaveBeenCalled();
    expect(sessionCount()).toBe(0);
  });

  it('does not deliver a CLI grant when the browser binding cookie is missing', async () => {
    const authorization = await begin();
    const cookies = cookiesOf(authorization);
    delete cookies[CLI.AUTH.REQUEST_COOKIE];
    const response = await callback(authorization, {}, cookies);
    expect(location(response).origin).toBe('http://localhost:5002');
    expect(location(response).searchParams.has('code')).toBe(false);
    // A valid ordinary browser handshake can still finish browser sign-in.
    expect(sessionCount()).toBe(1);
  });

  it('rejects a request cookie swapped between otherwise valid browser handshakes', async () => {
    const first = await begin();
    const second = await begin();
    const response = await callback(
      first,
      {},
      {
        ...cookiesOf(first),
        [CLI.AUTH.REQUEST_COOKIE]: cookiesOf(second)[CLI.AUTH.REQUEST_COOKIE]!,
      },
    );
    expect(location(response).searchParams.get('error')).toBe('state_mismatch');
    expect(exchangeGoogleCode).not.toHaveBeenCalled();
    expect((await callback(first)).headers.get('location')).toContain(INPUT.redirectUri);
  });

  it.each(['state', 'code', 'error'])(
    'rejects duplicate %s query parameters',
    async (parameter) => {
      const authorization = await begin();
      const state = location(authorization).searchParams.get('state')!;
      const query = new URLSearchParams({ code: 'google-code', state });
      if (parameter === 'error') query.append('error', 'access_denied');
      query.append(parameter, parameter === 'state' ? state : 'duplicate');
      const response = await app.request(`/api/auth/google/callback?${query}`, {
        headers: { cookie: cookieHeader(cookiesOf(authorization)) },
      });
      expect(location(response).searchParams.get('error')).toBe('state_mismatch');
      expect(exchangeGoogleCode).not.toHaveBeenCalled();
    },
  );

  it('returns a typed denial only to a loopback callback with a validated handshake', async () => {
    const authorization = await begin();
    const denied = await callback(authorization, { error: 'provider-secret-error', code: '' });
    expect(location(denied).origin).toBe('http://127.0.0.1:43123');
    expect(location(denied).searchParams.get('error')).toBe('provider_denied');
    expect(location(denied).searchParams.get('state')).toBe(INPUT.state);
    expect(denied.headers.get('location')).not.toContain('provider-secret-error');
    expect(exchangeGoogleCode).not.toHaveBeenCalled();
    expect(location(await callback(authorization)).searchParams.get('error')).toBe(
      'state_mismatch',
    );
    const unverified = await begin();
    const wrongState = await callback(unverified, { error: 'access_denied', state: 'wrong' });
    expect(location(wrongState).pathname).toBe('/login');
    expect(location(wrongState).searchParams.get('error')).toBe('state_mismatch');
  });

  it('sanitizes a provider failure and invalidates the claimed request', async () => {
    const authorization = await begin();
    vi.mocked(exchangeGoogleCode).mockRejectedValueOnce(new Error('provider-token-do-not-leak'));
    const failed = await callback(authorization);
    expect(location(failed).searchParams.get('error')).toBe('sign_in_failed');
    expect(failed.headers.get('location')).not.toContain('provider-token-do-not-leak');
    expect(location(await callback(authorization)).searchParams.get('error')).toBe(
      'state_mismatch',
    );
    expect(sessionCount()).toBe(0);
  });

  it('claims a request before awaiting Google so a duplicate callback cannot mint another session', async () => {
    const authorization = await begin();
    let release = (): void => {};
    let entered = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.mocked(exchangeGoogleCode).mockImplementationOnce(async () => {
      entered();
      await gate;
      return GOOGLE_TOKENS;
    });
    const first = callback(authorization);
    await started;
    try {
      expect(location(await callback(authorization)).searchParams.get('error')).toBe(
        'state_mismatch',
      );
      expect(exchangeGoogleCode).toHaveBeenCalledTimes(1);
    } finally {
      release();
    }
    expect(location(await first).searchParams.has('code')).toBe(true);
    expect(sessionCount()).toBe(1);
  });
});

describe('transient sign-in lifetime and capacity', () => {
  it('expires before browser authorization without allocating a session', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const started = await start();
    clock.mockReturnValue(now + CLI.AUTH.LOGIN_TTL_MS);
    expect((await app.request(started.authorizationUrl)).status).toBe(410);
    expect(exchangeGoogleCode).not.toHaveBeenCalled();
    expect(sessionCount()).toBe(0);
  });

  it('expires after authorization but before the Google callback', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const authorization = await begin();
    clock.mockReturnValue(now + CLI.AUTH.LOGIN_TTL_MS);
    expect(location(await callback(authorization)).searchParams.get('error')).toBe(
      'state_mismatch',
    );
    expect(exchangeGoogleCode).not.toHaveBeenCalled();
  });

  it('cannot revive a request that expires while Google is responding', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const authorization = await begin();
    vi.mocked(exchangeGoogleCode).mockImplementationOnce(async () => {
      clock.mockReturnValue(now + CLI.AUTH.LOGIN_TTL_MS);
      return GOOGLE_TOKENS;
    });
    const response = await callback(authorization);
    expect(location(response).searchParams.get('error')).toBe('sign_in_failed');
    expect(location(response).searchParams.has('code')).toBe(false);
    expect(location(response).searchParams.get('state')).toBe(INPUT.state);
  });

  it('expires an exchange code without affecting the browser session', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const response = await grant();
    clock.mockReturnValue(now + CLI.AUTH.EXCHANGE_TTL_MS);
    expect((await exchange(response)).status).toBe(400);
    expect((await me(cookiesOf(response)[SESSION_COOKIE_NAME]!)).status).toBe(200);
    expect(sessionCount()).toBe(1);
  });

  it('counts pending, processing and completed grants against one capacity limit', async () => {
    setConfigValues({ CLI_LOGIN_RATE_LIMIT_REQUESTS: 100, CLI_LOGIN_MAX_OUTSTANDING: 1 });
    const started = await start();
    const cappedPending = await app.request('/api/auth/cli/start', json(INPUT));
    expect(cappedPending.status).toBe(429);
    expect(Number(cappedPending.headers.get('retry-after'))).toBeGreaterThan(0);
    const authorization = await app.request(started.authorizationUrl);
    let release = (): void => {};
    let entered = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.mocked(exchangeGoogleCode).mockImplementationOnce(async () => {
      entered();
      await gate;
      return GOOGLE_TOKENS;
    });
    const callbackResponse = callback(authorization);
    await waiting;
    try {
      expect((await app.request('/api/auth/cli/start', json(INPUT))).status).toBe(429);
    } finally {
      release();
    }
    const completed = await callbackResponse;
    expect((await app.request('/api/auth/cli/start', json(INPUT))).status).toBe(429);
    expect((await exchange(completed)).status).toBe(200);
    expect((await app.request('/api/auth/cli/start', json(INPUT))).status).toBe(200);
  });

  it('reclaims capacity from expired pending requests and grants', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    setConfigValues({ CLI_LOGIN_RATE_LIMIT_REQUESTS: 100, CLI_LOGIN_MAX_OUTSTANDING: 1 });
    const stale = await start();
    clock.mockReturnValue(now + CLI.AUTH.LOGIN_TTL_MS);
    const replacement = await start();
    expect(replacement.authorizationUrl).not.toBe(stale.authorizationUrl);
    await callback(await app.request(replacement.authorizationUrl));
    clock.mockReturnValue(now + CLI.AUTH.LOGIN_TTL_MS + CLI.AUTH.EXCHANGE_TTL_MS);
    expect((await app.request('/api/auth/cli/start', json(INPUT))).status).toBe(200);
  });

  it('drops unfinished logins after restart while existing sessions remain valid', async () => {
    const first = await grant();
    const credential = CliLoginExchangeResponseSchema.parse(await (await exchange(first)).json());
    const pending = await start();
    const authorized = await begin();
    const completed = await grant();
    const restarted = createApp();
    expect((await restarted.request(pending.authorizationUrl)).status).toBe(410);
    expect(
      location(await callback(authorized, {}, cookiesOf(authorized), restarted)).searchParams.get(
        'error',
      ),
    ).toBe('state_mismatch');
    expect((await exchange(completed, {}, restarted)).status).toBe(400);
    expect((await me(credential.token, restarted)).status).toBe(200);
  });
});

describe('input validation and endpoint rate limits', () => {
  it.each([
    { route: '/start', declaredLength: true },
    { route: '/start', declaredLength: false },
    { route: '/exchange', declaredLength: true },
    { route: '/exchange', declaredLength: false },
  ])(
    'limits oversized $route bodies with declared length $declaredLength',
    async ({ route, declaredLength }) => {
      const body = JSON.stringify({
        ...INPUT,
        padding: 'oversized-secret-marker'.repeat(CLI.AUTH.MAX_BODY_BYTES),
      });
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (declaredLength) headers['content-length'] = String(Buffer.byteLength(body));
      const request = new Request(`http://localhost/api/auth/cli${route}`, {
        method: 'POST',
        headers,
        body,
      });
      expect(request.headers.has('content-length')).toBe(declaredLength);
      const response = await app.request(request);
      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({
        error: { message: 'CLI sign-in request is too large.' },
      });
      expect(sessionCount()).toBe(0);
    },
  );

  it.each([
    'https://127.0.0.1:43123/callback',
    'http://localhost:43123/callback',
    'http://[::1]:43123/callback',
    'http://127.0.0.2:43123/callback',
    'http://127.0.0.1/callback',
    'http://127.0.0.1:0/callback',
    'http://127.0.0.1:65536/callback',
    'http://127.0.0.1:043123/callback',
    'http://127.0.0.1:43123/other',
    'http://127.0.0.1:43123/callback?next=evil',
    'http://127.0.0.1:43123/callback#fragment',
    'http://user@127.0.0.1:43123/callback',
    'http://127.0.0.1.evil.test:43123/callback',
    'http://2130706433:43123/callback',
  ])('rejects unsafe or noncanonical redirect %s', async (redirectUri) => {
    expect((await app.request('/api/auth/cli/start', json({ ...INPUT, redirectUri }))).status).toBe(
      400,
    );
    expect(sessionCount()).toBe(0);
  });

  it.each([
    {},
    { ...INPUT, state: 'short' },
    { ...INPUT, codeChallenge: 'short' },
    { ...INPUT, codeChallengeMethod: 'plain' },
    { ...INPUT, unexpected: true },
  ])('rejects malformed start request %#', async (body) => {
    expect((await app.request('/api/auth/cli/start', json(body))).status).toBe(400);
  });

  it('rejects malformed JSON, ambiguous authorization ids and malformed exchanges', async () => {
    expect(
      (
        await app.request('/api/auth/cli/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{',
        })
      ).status,
    ).toBe(400);
    expect((await app.request('/api/auth/cli/authorize')).status).toBe(400);
    expect((await app.request('/api/auth/cli/authorize?request=a&request=b')).status).toBe(400);
    expect((await app.request('/api/auth/cli/exchange', json({}))).status).toBe(400);
    expect(
      (
        await app.request(
          '/api/auth/cli/exchange',
          json({ code: 'c'.repeat(43), codeVerifier: 'short', redirectUri: INPUT.redirectUri }),
        )
      ).status,
    ).toBe(400);
  });

  it('fails promptly without allocating pending state when Google OAuth is not configured', async () => {
    setConfigValues({ GOOGLE_OAUTH_CLIENT_ID: ' ', CLI_LOGIN_MAX_OUTSTANDING: 1 });
    const unavailable = await app.request('/api/auth/cli/start', json(INPUT));
    expect(unavailable.status).toBe(503);
    expect(sessionCount()).toBe(0);
    setConfigValues({ GOOGLE_OAUTH_CLIENT_ID: 'test-cli-client', CLI_LOGIN_MAX_OUTSTANDING: 1 });
    expect((await app.request('/api/auth/cli/start', json(INPUT))).status).toBe(200);
  });

  it('keeps independent pending attempts for two CLI processes behind the same NAT', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.20' };
    const first = await start(INPUT, headers);
    const secondInput: CliLoginStartRequest = {
      ...INPUT,
      state: 't'.repeat(43),
      redirectUri: 'http://127.0.0.1:43124/callback',
    };
    const second = await start(secondInput, headers);
    expect(first.authorizationUrl).not.toBe(second.authorizationUrl);
    const firstDone = await callback(await app.request(first.authorizationUrl));
    const secondDone = await callback(await app.request(second.authorizationUrl));
    expect(location(firstDone).searchParams.get('state')).toBe(INPUT.state);
    expect(location(secondDone).searchParams.get('state')).toBe(secondInput.state);
    expect(location(secondDone).port).toBe('43124');
  });

  it('returns 429 with Retry-After on a per-IP burst and resets after the window', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    setConfigValues({
      CLI_LOGIN_RATE_LIMIT_REQUESTS: 2,
      CLI_LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
      TRUSTED_PROXY_HOPS: 1,
    });
    const headers = { 'x-forwarded-for': '203.0.113.10' };
    await start(INPUT, headers);
    await start(INPUT, headers);
    const limited = await app.request('/api/auth/cli/start', json(INPUT, headers));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    expect(
      (await app.request('/api/auth/cli/start', json(INPUT, { 'x-forwarded-for': '203.0.113.11' })))
        .status,
    ).toBe(200);
    clock.mockReturnValue(now + 60_000);
    expect((await app.request('/api/auth/cli/start', json(INPUT, headers))).status).toBe(200);
  });

  it('uses separate rate budgets for start, authorization and exchange', async () => {
    setConfigValues({ CLI_LOGIN_RATE_LIMIT_REQUESTS: 1, CLI_LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60 });
    const started = await start();
    expect((await app.request('/api/auth/cli/start', json(INPUT))).status).toBe(429);
    const authorized = await app.request(started.authorizationUrl);
    expect(authorized.status).toBe(302);
    expect((await app.request(started.authorizationUrl)).status).toBe(429);
    const response = await callback(authorized);
    expect((await exchange(response)).status).toBe(200);
    expect((await exchange(response)).status).toBe(429);
  });

  it('ignores spoofed forwarding headers when no proxy is trusted', async () => {
    setConfigValues({ CLI_LOGIN_RATE_LIMIT_REQUESTS: 1, TRUSTED_PROXY_HOPS: 0 });
    await start(INPUT, { 'x-forwarded-for': '198.51.100.20' });
    expect(
      (await app.request('/api/auth/cli/start', json(INPUT, { 'x-forwarded-for': '203.0.113.20' })))
        .status,
    ).toBe(429);
  });

  it('resolves forwarding addresses from trusted hops and falls back for invalid addresses', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '198.51.100.20, 203.0.113.20' },
    });
    expect(resolveClientAddress(request, 0, '192.0.2.20')).toBe('192.0.2.20');
    expect(resolveClientAddress(request, 1, '192.0.2.20')).toBe('203.0.113.20');
    expect(resolveClientAddress(request, 2, '192.0.2.20')).toBe('198.51.100.20');
    expect(resolveClientAddress(request, 3, '192.0.2.20')).toBe('192.0.2.20');
    expect(
      resolveClientAddress(
        new Request('http://localhost', { headers: { 'x-forwarded-for': 'invalid' } }),
        1,
        '192.0.2.20',
      ),
    ).toBe('192.0.2.20');
  });

  it.each(['/approve', '/poll'])(
    'returns upgrade guidance for retired endpoint %s',
    async (route) => {
      const response = await app.request(`/api/auth/cli${route}`, json({}));
      expect(response.status).toBe(410);
      expect(await response.text()).toContain('Upgrade the CLI');
      expect(sessionCount()).toBe(0);
    },
  );
});
