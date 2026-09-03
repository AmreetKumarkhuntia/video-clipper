/**
 * Cookie names shared by the OAuth start and callback routes — the state,
 * PKCE verifier, and return path written at /api/youtube/auth/start and
 * consumed at /api/youtube/connection/oauth/callback.
 */
export const OAUTH_STATE_COOKIE = 'yt_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'yt_oauth_verifier';
export const OAUTH_RETURN_TO_COOKIE = 'yt_oauth_return_to';

/** Unpadded URL-safe base64, as used for the OAuth state and PKCE verifier. */
export function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
