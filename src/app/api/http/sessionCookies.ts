import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { SESSION_COOKIE_NAME } from '@lib/types/api.js';
import type { Context } from 'hono';
import type { ApiEnv } from '../context.js';

/**
 * Cookies for the sign-in flow.
 *
 * Deliberately named apart from the publish connect flow's `yt_oauth_*` cookies
 * so a customer midway through connecting YouTube cannot collide with a sign-in.
 */
export const LOGIN_STATE_COOKIE = 'vc_login_state';
export const LOGIN_VERIFIER_COOKIE = 'vc_login_verifier';
export const LOGIN_RETURN_TO_COOKIE = 'vc_login_return_to';

const HANDSHAKE_TTL_SEC = 60 * 10;

/**
 * Only same-origin paths. Blocks `//evil.com`, which a browser treats as
 * protocol-relative and would follow off-site after a successful sign-in.
 */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

/**
 * Whether to mark cookies Secure.
 *
 * Read from the request URL rather than a config flag, because in development
 * the backend is reached over plain http through the Vite proxy and a Secure
 * cookie would simply never come back.
 */
function isSecureRequest(c: Context<ApiEnv>): boolean {
  return new URL(c.req.url).protocol === 'https:';
}

/** `sameSite: 'Lax'` is required: the OAuth callback is a top-level GET from Google. */
export function setHandshakeCookies(
  c: Context<ApiEnv>,
  values: { state: string; codeVerifier: string; returnTo: string },
): void {
  const options = {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: isSecureRequest(c),
    maxAge: HANDSHAKE_TTL_SEC,
  } as const;
  setCookie(c, LOGIN_STATE_COOKIE, values.state, options);
  setCookie(c, LOGIN_VERIFIER_COOKIE, values.codeVerifier, options);
  setCookie(c, LOGIN_RETURN_TO_COOKIE, values.returnTo, options);
}

export function readHandshakeCookies(c: Context<ApiEnv>): {
  state?: string;
  codeVerifier?: string;
  returnTo: string;
} {
  return {
    ...(getCookie(c, LOGIN_STATE_COOKIE) !== undefined
      ? { state: getCookie(c, LOGIN_STATE_COOKIE)! }
      : {}),
    ...(getCookie(c, LOGIN_VERIFIER_COOKIE) !== undefined
      ? { codeVerifier: getCookie(c, LOGIN_VERIFIER_COOKIE)! }
      : {}),
    returnTo: sanitizeReturnTo(getCookie(c, LOGIN_RETURN_TO_COOKIE)),
  };
}

export function clearHandshakeCookies(c: Context<ApiEnv>): void {
  for (const name of [LOGIN_STATE_COOKIE, LOGIN_VERIFIER_COOKIE, LOGIN_RETURN_TO_COOKIE]) {
    deleteCookie(c, name, { path: '/' });
  }
}

export function readSessionToken(c: Context<ApiEnv>): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME);
}

export function setSessionCookie(c: Context<ApiEnv>, token: string, expiresAt: number): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: isSecureRequest(c),
    expires: new Date(expiresAt),
  });
}

/** `path` must match the one used to set it, or the browser keeps the cookie. */
export function clearSessionCookie(c: Context<ApiEnv>): void {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
}
