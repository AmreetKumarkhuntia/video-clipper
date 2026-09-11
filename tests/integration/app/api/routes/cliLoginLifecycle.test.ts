import { describe, expect, it, vi } from 'vitest';
import { setConfigValues } from '@lib/config/index.js';
import { CLI } from '@lib/utils/constants.js';
import { SESSION_COOKIE_NAME } from '@lib/types/api.js';
import type { CliLoginStartRequest } from '@lib/types/api.js';
import {
  GOOGLE_TOKENS,
  INPUT,
  app,
  begin,
  callback,
  cookiesOf,
  exchange,
  exchangeGoogleCodeMock,
  exchangeSession,
  grant,
  json,
  locationOf,
  me,
  restartedApp,
  sessionCount,
  start,
} from './cliLogin.fixture.js';

describe('CLI login lifetime and capacity', () => {
  it('expires a request before browser authorization without allocating a session', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const started = await start();

    vi.mocked(Date.now).mockReturnValue(now + CLI.AUTH.LOGIN_TTL_MS);
    expect((await app().request(started.authorizationUrl)).status).toBe(410);
    expect(exchangeGoogleCodeMock()).not.toHaveBeenCalled();
    expect(sessionCount()).toBe(0);
  });

  it('expires a request after authorization but before the provider callback', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const authorization = await begin();

    vi.mocked(Date.now).mockReturnValue(now + CLI.AUTH.LOGIN_TTL_MS);
    expect(locationOf(await callback(authorization)).searchParams.get('error')).toBe(
      'state_mismatch',
    );
    expect(exchangeGoogleCodeMock()).not.toHaveBeenCalled();
  });

  it('cannot revive a request that expires while the provider responds', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const authorization = await begin();
    vi.mocked(exchangeGoogleCodeMock()).mockImplementationOnce(async () => {
      vi.mocked(Date.now).mockReturnValue(now + CLI.AUTH.LOGIN_TTL_MS);
      return GOOGLE_TOKENS;
    });

    const response = await callback(authorization);
    expect(locationOf(response).searchParams.get('error')).toBe('sign_in_failed');
    expect(locationOf(response).searchParams.has('code')).toBe(false);
    expect(locationOf(response).searchParams.get('state')).toBe(INPUT.state);
  });

  it('expires an exchange grant without affecting the browser session', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const response = await grant();

    vi.mocked(Date.now).mockReturnValue(now + CLI.AUTH.EXCHANGE_TTL_MS);
    expect((await exchange(response)).status).toBe(400);
    expect((await me(cookiesOf(response)[SESSION_COOKIE_NAME]!)).status).toBe(200);
    expect(sessionCount()).toBe(1);
  });

  it('counts pending, processing and completed grants against one capacity limit', async () => {
    setConfigValues({ CLI_LOGIN_RATE_LIMIT_REQUESTS: 100, CLI_LOGIN_MAX_OUTSTANDING: 1 });
    const started = await start();
    const cappedPending = await app().request('/api/auth/cli/start', json(INPUT));
    expect(cappedPending.status).toBe(429);
    expect(Number(cappedPending.headers.get('retry-after'))).toBeGreaterThan(0);

    const authorization = await app().request(started.authorizationUrl);
    let release = (): void => {};
    let entered = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.mocked(exchangeGoogleCodeMock()).mockImplementationOnce(async () => {
      entered();
      await gate;
      return GOOGLE_TOKENS;
    });

    const callbackResponse = callback(authorization);
    await waiting;
    try {
      expect((await app().request('/api/auth/cli/start', json(INPUT))).status).toBe(429);
    } finally {
      release();
    }
    const completed = await callbackResponse;
    expect((await app().request('/api/auth/cli/start', json(INPUT))).status).toBe(429);
    expect((await exchange(completed)).status).toBe(200);
    expect((await app().request('/api/auth/cli/start', json(INPUT))).status).toBe(200);
  });

  it('reclaims capacity from expired pending requests and exchange grants', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    setConfigValues({ CLI_LOGIN_RATE_LIMIT_REQUESTS: 100, CLI_LOGIN_MAX_OUTSTANDING: 1 });

    const stale = await start();
    vi.mocked(Date.now).mockReturnValue(now + CLI.AUTH.LOGIN_TTL_MS);
    const replacement = await start();
    expect(replacement.authorizationUrl).not.toBe(stale.authorizationUrl);
    await callback(await app().request(replacement.authorizationUrl));

    vi.mocked(Date.now).mockReturnValue(now + CLI.AUTH.LOGIN_TTL_MS + CLI.AUTH.EXCHANGE_TTL_MS);
    expect((await app().request('/api/auth/cli/start', json(INPUT))).status).toBe(200);
  });

  it('drops unfinished login state after restart while existing sessions remain valid', async () => {
    const first = await grant();
    const credential = await exchangeSession(first);
    const pending = await start();
    const authorized = await begin();
    const completed = await grant();
    const restarted = restartedApp();

    expect((await restarted.request(pending.authorizationUrl)).status).toBe(410);
    expect(
      locationOf(await callback(authorized, {}, cookiesOf(authorized), restarted)).searchParams.get(
        'error',
      ),
    ).toBe('state_mismatch');
    expect((await exchange(completed, {}, restarted)).status).toBe(400);
    expect((await me(credential.token, restarted)).status).toBe(200);
  });
});

describe('CLI login endpoint validation and rate limits', () => {
  it.each([
    { route: '/start', declaredLength: true },
    { route: '/start', declaredLength: false },
    { route: '/exchange', declaredLength: true },
    { route: '/exchange', declaredLength: false },
  ])(
    'limits an oversized $route body with declared length $declaredLength',
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

      const response = await app().request(request);
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
    'http://127.0.0.1:43123/callback?next=evil',
  ])('rejects unsafe redirect URI %s at the API boundary', async (redirectUri) => {
    expect(
      (await app().request('/api/auth/cli/start', json({ ...INPUT, redirectUri }))).status,
    ).toBe(400);
    expect(sessionCount()).toBe(0);
  });

  it('rejects malformed JSON, start payloads, authorization ids and exchanges', async () => {
    expect(
      (
        await app().request('/api/auth/cli/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{',
        })
      ).status,
    ).toBe(400);
    expect(
      (await app().request('/api/auth/cli/start', json({ ...INPUT, state: 'short' }))).status,
    ).toBe(400);
    expect((await app().request('/api/auth/cli/authorize')).status).toBe(400);
    expect((await app().request('/api/auth/cli/authorize?request=a&request=b')).status).toBe(400);
    expect((await app().request('/api/auth/cli/exchange', json({}))).status).toBe(400);
  });

  it('fails without allocating pending state when Google OAuth is not configured', async () => {
    setConfigValues({ GOOGLE_OAUTH_CLIENT_ID: ' ', CLI_LOGIN_MAX_OUTSTANDING: 1 });
    expect((await app().request('/api/auth/cli/start', json(INPUT))).status).toBe(503);
    expect(sessionCount()).toBe(0);

    setConfigValues({ GOOGLE_OAUTH_CLIENT_ID: 'test-cli-client' });
    expect((await app().request('/api/auth/cli/start', json(INPUT))).status).toBe(200);
  });

  it('keeps independent attempts for two CLI processes behind the same NAT', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.20' };
    const first = await start(INPUT, headers);
    const secondInput: CliLoginStartRequest = {
      ...INPUT,
      state: 't'.repeat(43),
      redirectUri: 'http://127.0.0.1:43124/callback',
    };
    const second = await start(secondInput, headers);

    expect(first.authorizationUrl).not.toBe(second.authorizationUrl);
    const firstDone = await callback(await app().request(first.authorizationUrl));
    const secondDone = await callback(await app().request(second.authorizationUrl));
    expect(locationOf(firstDone).searchParams.get('state')).toBe(INPUT.state);
    expect(locationOf(secondDone).searchParams.get('state')).toBe(secondInput.state);
    expect(locationOf(secondDone).port).toBe('43124');
  });

  it('returns Retry-After on a per-IP burst and resets after the window', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    setConfigValues({
      CLI_LOGIN_RATE_LIMIT_REQUESTS: 2,
      CLI_LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
      TRUSTED_PROXY_HOPS: 1,
    });
    const headers = { 'x-forwarded-for': '203.0.113.10' };
    await start(INPUT, headers);
    await start(INPUT, headers);

    const limited = await app().request('/api/auth/cli/start', json(INPUT, headers));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    expect(
      (
        await app().request(
          '/api/auth/cli/start',
          json(INPUT, { 'x-forwarded-for': '203.0.113.11' }),
        )
      ).status,
    ).toBe(200);

    vi.mocked(Date.now).mockReturnValue(now + 60_000);
    expect((await app().request('/api/auth/cli/start', json(INPUT, headers))).status).toBe(200);
  });

  it('uses separate rate budgets for start, authorization and exchange', async () => {
    setConfigValues({ CLI_LOGIN_RATE_LIMIT_REQUESTS: 1, CLI_LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60 });
    const started = await start();
    expect((await app().request('/api/auth/cli/start', json(INPUT))).status).toBe(429);

    const authorized = await app().request(started.authorizationUrl);
    expect(authorized.status).toBe(302);
    expect((await app().request(started.authorizationUrl)).status).toBe(429);

    const response = await callback(authorized);
    expect((await exchange(response)).status).toBe(200);
    expect((await exchange(response)).status).toBe(429);
  });

  it('ignores spoofed forwarding headers when no proxy is trusted', async () => {
    setConfigValues({ CLI_LOGIN_RATE_LIMIT_REQUESTS: 1, TRUSTED_PROXY_HOPS: 0 });
    await start(INPUT, { 'x-forwarded-for': '198.51.100.20' });

    expect(
      (
        await app().request(
          '/api/auth/cli/start',
          json(INPUT, { 'x-forwarded-for': '203.0.113.20' }),
        )
      ).status,
    ).toBe(429);
  });

  it.each(['/approve', '/poll'])(
    'returns upgrade guidance for retired endpoint %s',
    async (route) => {
      const response = await app().request(`/api/auth/cli${route}`, json({}));
      expect(response.status).toBe(410);
      expect(await response.text()).toContain('Upgrade the CLI');
      expect(sessionCount()).toBe(0);
    },
  );
});
