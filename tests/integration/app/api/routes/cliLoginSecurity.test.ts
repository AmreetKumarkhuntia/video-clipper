import { describe, expect, it, vi } from 'vitest';
import { LOGIN_STATE_COOKIE, LOGIN_VERIFIER_COOKIE } from '@app/api/http/sessionCookies.js';
import { CLI } from '@lib/utils/constants.js';
import {
  GOOGLE_TOKENS,
  INPUT,
  app,
  begin,
  callback,
  cookieHeader,
  cookiesOf,
  exchangeGoogleCodeMock,
  locationOf,
  sessionCount,
} from './cliLogin.fixture.js';

describe('CLI login callback binding', () => {
  it.each([
    'wrong-state',
    'missing-state-cookie',
    'missing-verifier-cookie',
    'unknown-request-cookie',
  ])('rejects %s before contacting Google or following the loopback redirect', async (scenario) => {
    const authorization = await begin();
    const cookies = cookiesOf(authorization);
    const query: Record<string, string> = {};
    if (scenario === 'wrong-state') query.state = 'unrelated-state';
    if (scenario === 'missing-state-cookie') delete cookies[LOGIN_STATE_COOKIE];
    if (scenario === 'missing-verifier-cookie') delete cookies[LOGIN_VERIFIER_COOKIE];
    if (scenario === 'unknown-request-cookie') cookies[CLI.AUTH.REQUEST_COOKIE] = 'unknown-request';

    const response = await callback(authorization, query, cookies);
    expect(locationOf(response).pathname).toBe('/login');
    expect(locationOf(response).searchParams.get('error')).toBe('state_mismatch');
    expect(exchangeGoogleCodeMock()).not.toHaveBeenCalled();
    expect(sessionCount()).toBe(0);
  });

  it('completes ordinary browser sign-in without delivering a CLI grant when binding is absent', async () => {
    const authorization = await begin();
    const cookies = cookiesOf(authorization);
    delete cookies[CLI.AUTH.REQUEST_COOKIE];

    const response = await callback(authorization, {}, cookies);
    expect(locationOf(response).origin).toBe('http://localhost:5002');
    expect(locationOf(response).searchParams.has('code')).toBe(false);
    expect(sessionCount()).toBe(1);
  });

  it('rejects a request cookie swapped between valid browser handshakes', async () => {
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

    expect(locationOf(response).searchParams.get('error')).toBe('state_mismatch');
    expect(exchangeGoogleCodeMock()).not.toHaveBeenCalled();
    expect((await callback(first)).headers.get('location')).toContain(INPUT.redirectUri);
  });

  it.each(['state', 'code', 'error'])(
    'rejects duplicate %s query parameters',
    async (parameter) => {
      const authorization = await begin();
      const state = locationOf(authorization).searchParams.get('state')!;
      const query = new URLSearchParams({ code: 'google-code', state });
      if (parameter === 'error') query.append('error', 'access_denied');
      query.append(parameter, parameter === 'state' ? state : 'duplicate');

      const response = await app().request(`/api/auth/google/callback?${query}`, {
        headers: { cookie: cookieHeader(cookiesOf(authorization)) },
      });
      expect(locationOf(response).searchParams.get('error')).toBe('state_mismatch');
      expect(exchangeGoogleCodeMock()).not.toHaveBeenCalled();
    },
  );

  it('returns a typed provider denial only to a validated loopback callback', async () => {
    const authorization = await begin();
    const denied = await callback(authorization, { error: 'provider-secret-error', code: '' });

    expect(locationOf(denied).origin).toBe('http://127.0.0.1:43123');
    expect(locationOf(denied).searchParams.get('error')).toBe('provider_denied');
    expect(locationOf(denied).searchParams.get('state')).toBe(INPUT.state);
    expect(denied.headers.get('location')).not.toContain('provider-secret-error');
    expect(exchangeGoogleCodeMock()).not.toHaveBeenCalled();
    expect(locationOf(await callback(authorization)).searchParams.get('error')).toBe(
      'state_mismatch',
    );

    const unverified = await begin();
    const wrongState = await callback(unverified, { error: 'access_denied', state: 'wrong' });
    expect(locationOf(wrongState).pathname).toBe('/login');
    expect(locationOf(wrongState).searchParams.get('error')).toBe('state_mismatch');
  });

  it('sanitizes a provider failure and invalidates the claimed request', async () => {
    const authorization = await begin();
    vi.mocked(exchangeGoogleCodeMock()).mockRejectedValueOnce(
      new Error('provider-token-do-not-leak'),
    );

    const failed = await callback(authorization);
    expect(locationOf(failed).searchParams.get('error')).toBe('sign_in_failed');
    expect(failed.headers.get('location')).not.toContain('provider-token-do-not-leak');
    expect(locationOf(await callback(authorization)).searchParams.get('error')).toBe(
      'state_mismatch',
    );
    expect(sessionCount()).toBe(0);
  });

  it('claims a request before awaiting Google so duplicate callbacks cannot mint a session', async () => {
    const authorization = await begin();
    let release = (): void => {};
    let entered = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.mocked(exchangeGoogleCodeMock()).mockImplementationOnce(async () => {
      entered();
      await gate;
      return GOOGLE_TOKENS;
    });

    const first = callback(authorization);
    await started;
    try {
      expect(locationOf(await callback(authorization)).searchParams.get('error')).toBe(
        'state_mismatch',
      );
      expect(exchangeGoogleCodeMock()).toHaveBeenCalledTimes(1);
    } finally {
      release();
    }

    expect(locationOf(await first).searchParams.has('code')).toBe(true);
    expect(sessionCount()).toBe(1);
  });
});
