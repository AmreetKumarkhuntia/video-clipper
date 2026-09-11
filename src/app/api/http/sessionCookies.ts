import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { SESSION_COOKIE_NAME } from '@lib/types/api.js';
import type { Context } from 'hono';
import type { ApiEnv } from '../context.js';
import { CLI } from '@lib/utils/constants.js';

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
 * Only same-origin paths. Blocks `//evil.com` and `/\evil.com` — the WHATWG
 * parser treats `\` as `/`, so both are protocol-relative and a browser would
 * follow them off-site after a successful sign-in. Control characters are
 * rejected outright because URL parsers strip tab and newline before resolving,
 * which would smuggle a second slash past a prefix check.
 */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/')) return '/';
  // eslint-disable-next-line no-control-regex
  if (/^\/[/\\]/.test(value) || /[\u0000-\u001f\u007f]/.test(value)) return '/';
  return value;
}

/**
 * Whether to mark cookies Secure.
 *
 * `x-forwarded-proto` wins because in production TLS terminates at a proxy and
 * the request reaches Node as plain http — the URL alone would never say
 * `https:` and the session cookie would silently ship without Secure. The URL
 * is the fallback for direct connections; in development the backend is
 * reached over plain http through the Vite proxy (which sends no forwarded
 * header), so a Secure cookie would simply never come back.
 */
function isSecureRequest(c: Context<ApiEnv>): boolean {
  const forwarded = c.req.header('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0]!.trim() === 'https';
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

export function setCliRequestCookie(c: Context<ApiEnv>, requestId: string): void {
  setCookie(c, CLI.AUTH.REQUEST_COOKIE, requestId, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: isSecureRequest(c),
    maxAge: CLI.AUTH.HANDSHAKE_TTL_SEC,
  });
}

export function readCliRequestCookie(c: Context<ApiEnv>): string | undefined {
  return getCookie(c, CLI.AUTH.REQUEST_COOKIE);
}

export function clearCliRequestCookie(c: Context<ApiEnv>): void {
  deleteCookie(c, CLI.AUTH.REQUEST_COOKIE, { path: '/', secure: isSecureRequest(c) });
}

/**
 * One session mechanism, two carriers. A browser holds the token in the cookie;
 * the CLI, which has no cookie jar, sends the same token as a bearer header.
 * The header wins when both are present: it is the explicit one.
 */
export function readSessionToken(c: Context<ApiEnv>): string | undefined {
  const header = c.req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token) return token;
  }
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
