import { randomBytes } from 'crypto';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import {
  buildYouTubeOAuthAuthorizationUrl,
  completeYouTubeOAuthCallback,
  disconnectYouTubeAuth,
  getYouTubeAuthStatus,
} from '@lib/services/publish/index.js';
import { log } from '@lib/utils/logger.js';
import { toYouTubeOAuthConfig } from '../services/appConfig.js';
import { errorMessage } from '../http/responses.js';
import {
  OAUTH_RETURN_TO_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  toBase64Url,
} from '../http/oauthCookies.js';
import type { Context } from 'hono';
import type { ApiEnv } from '../context.js';

/** The handshake cookies only need to outlive a trip to Google's consent screen. */
const HANDSHAKE_COOKIE_MAX_AGE_SECONDS = 60 * 10;

/**
 * The operator's YouTube publishing connection, modelled as a single resource:
 * `GET /` reads it, `DELETE /` drops it, and the `/oauth/*` pair is the browser
 * handshake that creates it.
 *
 * The prototype's manual token-paste route is deliberately absent — it wrote an
 * auth state with no verified identity behind it.
 */
export const connectionRoutes = new Hono<ApiEnv>();

connectionRoutes.get('/', async (c) => {
  const status = await getYouTubeAuthStatus(toYouTubeOAuthConfig(c.get('config')));
  return c.json(status);
});

connectionRoutes.delete('/', async (c) => {
  await disconnectYouTubeAuth();
  return c.json({ success: true });
});

connectionRoutes.get('/oauth/start', (c) => {
  const returnTo = sanitizeReturnTo(c.req.query('returnTo') ?? null);
  const state = toBase64Url(randomBytes(24));
  const codeVerifier = toBase64Url(randomBytes(48));

  // Built before the cookies are written: an unconfigured OAuth client throws
  // here, and there is no point leaving a handshake in the browser for a
  // redirect that never happens.
  const authUrl = buildYouTubeOAuthAuthorizationUrl(
    { state, codeVerifier, returnTo },
    toYouTubeOAuthConfig(c.get('config')),
  );

  setHandshakeCookie(c, OAUTH_STATE_COOKIE, state);
  setHandshakeCookie(c, OAUTH_VERIFIER_COOKIE, codeVerifier);
  setHandshakeCookie(c, OAUTH_RETURN_TO_COOKIE, returnTo);

  return c.redirect(authUrl, 302);
});

connectionRoutes.get('/oauth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const authError = c.req.query('error');
  const expectedState = getCookie(c, OAUTH_STATE_COOKIE);
  const codeVerifier = getCookie(c, OAUTH_VERIFIER_COOKIE);
  // Re-sanitized on the way out: the cookie is client-supplied and only the
  // value written at /oauth/start is a safe redirect target.
  const returnTo = sanitizeReturnTo(getCookie(c, OAUTH_RETURN_TO_COOKIE) ?? null);

  // Cleared before any branch so a replayed callback cannot reuse this handshake.
  clearHandshakeCookies(c);

  if (authError) {
    return c.redirect(appendAuthError(returnTo, `Google OAuth failed: ${authError}`), 302);
  }

  if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
    log.warn('api.connection', 'oauth callback validation failed', c.get('requestId'), {
      hasCode: Boolean(code),
      hasHandshake: Boolean(expectedState && codeVerifier),
      stateMatched: Boolean(state && expectedState && state === expectedState),
    });
    return c.redirect(appendAuthError(returnTo, 'Google OAuth callback validation failed.'), 302);
  }

  try {
    await completeYouTubeOAuthCallback(
      code,
      { state, codeVerifier, returnTo },
      toYouTubeOAuthConfig(c.get('config')),
    );
  } catch (error) {
    // The caller is a browser mid-redirect, so a failure is reported on the page
    // it came from rather than as an error envelope it would never render.
    const message = errorMessage(error);
    log.warn('api.connection', 'oauth token exchange failed', c.get('requestId'), {
      error: message,
    });
    return c.redirect(appendAuthError(returnTo, message), 302);
  }

  return c.redirect(returnTo, 302);
});

/** Only a same-origin absolute path is a safe redirect target; `//host` is not. */
function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}

function appendAuthError(returnTo: string, message: string): string {
  // The base is a parsing convenience only — nothing but path and query is kept.
  const url = new URL(returnTo, 'http://localhost');
  url.searchParams.set('authError', message);
  return `${url.pathname}${url.search}`;
}

function setHandshakeCookie(c: Context<ApiEnv>, name: string, value: string): void {
  setCookie(c, name, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    // Derived rather than hardcoded so a deployment behind TLS gets a secure
    // cookie without the local http flow silently dropping it.
    secure: new URL(c.req.url).protocol === 'https:',
    maxAge: HANDSHAKE_COOKIE_MAX_AGE_SECONDS,
  });
}

function clearHandshakeCookies(c: Context<ApiEnv>): void {
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
  deleteCookie(c, OAUTH_VERIFIER_COOKIE, { path: '/' });
  deleteCookie(c, OAUTH_RETURN_TO_COOKIE, { path: '/' });
}
