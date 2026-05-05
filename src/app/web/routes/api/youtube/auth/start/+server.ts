import { randomBytes } from 'crypto';
import { redirect } from '@sveltejs/kit';
import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { buildYouTubeOAuthAuthorizationUrl } from '@app/web/lib/services/youtube/uploadAuth.js';
import { log } from '@lib/utils/logger.js';

const OAUTH_STATE_COOKIE = 'yt_oauth_state';
const OAUTH_VERIFIER_COOKIE = 'yt_oauth_verifier';
const OAUTH_RETURN_TO_COOKIE = 'yt_oauth_return_to';

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
  const reqDone = log.request('GET', '/api/youtube/auth/start', locals.requestId);
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));
  const state = toBase64Url(randomBytes(24));
  const codeVerifier = toBase64Url(randomBytes(48));

  setOAuthCookie(cookies, OAUTH_STATE_COOKIE, state);
  setOAuthCookie(cookies, OAUTH_VERIFIER_COOKIE, codeVerifier);
  setOAuthCookie(cookies, OAUTH_RETURN_TO_COOKIE, returnTo);

  const authUrl = buildYouTubeOAuthAuthorizationUrl({
    state,
    codeVerifier,
    returnTo,
  });

  reqDone(302);
  throw redirect(302, authUrl);
};

function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}

function setOAuthCookie(cookies: Cookies, name: string, value: string): void {
  cookies.set(name, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 60 * 10,
  });
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
