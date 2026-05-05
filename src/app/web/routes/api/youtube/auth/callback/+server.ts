import { redirect } from '@sveltejs/kit';
import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { completeYouTubeOAuthCallback } from '@app/web/lib/services/youtube/uploadAuth.js';
import { log } from '@lib/utils/logger.js';

const OAUTH_STATE_COOKIE = 'yt_oauth_state';
const OAUTH_VERIFIER_COOKIE = 'yt_oauth_verifier';
const OAUTH_RETURN_TO_COOKIE = 'yt_oauth_return_to';

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
  const reqDone = log.request('GET', '/api/youtube/auth/callback', locals.requestId);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const authError = url.searchParams.get('error');
  const expectedState = cookies.get(OAUTH_STATE_COOKIE);
  const codeVerifier = cookies.get(OAUTH_VERIFIER_COOKIE);
  const returnTo = cookies.get(OAUTH_RETURN_TO_COOKIE) ?? '/';

  clearOAuthCookies(cookies);

  if (authError) {
    reqDone(302);
    throw redirect(302, appendAuthError(returnTo, `Google OAuth failed: ${authError}`));
  }

  if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
    reqDone(302);
    throw redirect(302, appendAuthError(returnTo, 'Google OAuth callback validation failed.'));
  }

  try {
    await completeYouTubeOAuthCallback(code, {
      state,
      codeVerifier,
      returnTo,
    });
    reqDone(302);
    throw redirect(302, returnTo);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reqDone(302);
    throw redirect(302, appendAuthError(returnTo, message));
  }
};

function clearOAuthCookies(cookies: Cookies): void {
  cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });
  cookies.delete(OAUTH_VERIFIER_COOKIE, { path: '/' });
  cookies.delete(OAUTH_RETURN_TO_COOKIE, { path: '/' });
}

function appendAuthError(returnTo: string, message: string): string {
  const url = new URL(returnTo, 'http://localhost');
  url.searchParams.set('authError', message);
  return `${url.pathname}${url.search}`;
}
