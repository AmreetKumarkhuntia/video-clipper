import { describe, expect, it } from 'vitest';
import { LOGIN_STATE_COOKIE, LOGIN_VERIFIER_COOKIE } from '@app/api/http/sessionCookies.js';
import { SESSION_COOKIE_NAME } from '@lib/types/api.js';
import { CLI } from '@lib/utils/constants.js';
import { createCodeChallenge } from '@lib/utils/googleOAuth.js';
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
  locationOf,
  me,
  sessionCount,
  sqlite,
  start,
} from './cliLogin.fixture.js';

describe('CLI login flow', () => {
  it('binds a fresh request to browser cookies and Google state without issuing a session', async () => {
    const started = await start();
    expect(started.expiresAt).toBeGreaterThan(Date.now());
    expect(new URL(started.authorizationUrl).origin).toBe('http://localhost:5002');

    const authorized = await app().request(started.authorizationUrl);
    const cookies = cookiesOf(authorized);
    const google = locationOf(authorized);
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
    expect((await app().request(started.authorizationUrl)).status).toBe(410);
  });

  it('redirects only an exchange code and caller state, then issues separate sessions', async () => {
    const authorized = await begin();
    const response = await callback(authorized);
    const redirected = locationOf(response);
    const browserToken = cookiesOf(response)[SESSION_COOKIE_NAME]!;

    expect(`${redirected.origin}${redirected.pathname}`).toBe(INPUT.redirectUri);
    expect([...redirected.searchParams.keys()].sort()).toEqual(['code', 'state']);
    expect(redirected.searchParams.get('state')).toBe(INPUT.state);
    expect(redirected.toString()).not.toContain(browserToken);
    expect(redirected.toString()).not.toContain(GOOGLE_TOKENS.access_token);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(exchangeGoogleCodeMock()).toHaveBeenCalledWith(
      'google-code',
      cookiesOf(authorized)[LOGIN_VERIFIER_COOKIE],
      expect.any(Object),
    );
    expect(sessionCount()).toBe(1);

    const result = await exchangeSession(response);
    expect(result.token).not.toBe(browserToken);
    expect(redirected.toString()).not.toContain(result.token);
    expect(sessionCount()).toBe(2);
    expect((await me(result.token)).status).toBe(200);
    expect(
      (
        await app().request('/api/me', {
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
      const cliSession = await exchangeSession(response);
      const outgoing = kind === 'browser' ? browserToken : cliSession.token;
      const retained = kind === 'browser' ? cliSession.token : browserToken;
      const headers: Record<string, string> =
        kind === 'browser'
          ? { cookie: `${SESSION_COOKIE_NAME}=${outgoing}` }
          : { authorization: `Bearer ${outgoing}` };

      expect((await app().request('/api/auth/signout', { method: 'POST', headers })).status).toBe(
        200,
      );
      expect((await me(outgoing)).status).toBe(401);
      expect((await me(retained)).status).toBe(200);
    },
  );

  it('rotates an existing browser session while keeping an older CLI session alive', async () => {
    const first = await grant();
    const oldBrowserToken = cookiesOf(first)[SESSION_COOKIE_NAME]!;
    const oldCli = await exchangeSession(first);
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

  it('does not consume a grant when the verifier or redirect URI is incorrect', async () => {
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
