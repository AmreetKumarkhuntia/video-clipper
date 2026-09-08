import { createHash, randomBytes } from 'node:crypto';
import {
  GoogleTokenResponseSchema,
  GoogleUserInfoSchema,
  type GoogleOAuthClientConfig,
  type GoogleTokenResponse,
  type GoogleUserInfo,
  type OwnedYouTubeChannel,
} from '@lib/types/auth.js';

/**
 * Stateless Google OAuth mechanics for sign-in.
 *
 * Lives in utils rather than a service because the caller that needs it —
 * `orchestration/authOrchestrator.ts` — also touches the database, and the
 * service-boundary rules keep services out of the db. Nothing here reads config
 * or persists anything; credentials are always passed in.
 *
 * `services/publish/oauth.ts` still has its own copy of the token exchange for
 * the publish flow. Consolidating the two is a follow-up, deliberately not done
 * here so the working publish path stays untouched.
 */

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const YOUTUBE_OWNED_CHANNEL_URL =
  'https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true';

/**
 * Scopes requested at sign-in. Deliberately minimal: identity plus read access to
 * the customer's own channel. Upload and caption scopes are requested later, via
 * incremental auth, so the first consent screen stays light.
 * See docs/guides/google-oauth-scopes.md.
 */
export const GOOGLE_SIGN_IN_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/youtube.readonly',
];

export function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** PKCE verifier — 256 bits. Also the right generator for a session token. */
export function createCodeVerifier(): string {
  return toBase64Url(randomBytes(32));
}

export function createOAuthState(): string {
  return toBase64Url(randomBytes(24));
}

export function createCodeChallenge(verifier: string): string {
  return toBase64Url(createHash('sha256').update(verifier).digest());
}

export function isGoogleOAuthConfigured(oauth: GoogleOAuthClientConfig): boolean {
  return Boolean(oauth.clientId?.trim() && oauth.clientSecret?.trim() && oauth.redirectUri?.trim());
}

function assertConfigured(oauth: GoogleOAuthClientConfig): void {
  if (!isGoogleOAuthConfigured(oauth)) {
    throw new Error(
      'Configure GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI before signing in.',
    );
  }
}

/**
 * `access_type=offline` with `prompt=consent` is what makes Google return a
 * refresh token. Without them a returning user yields an access token only.
 */
export function buildGoogleAuthUrl(
  oauth: GoogleOAuthClientConfig,
  state: string,
  codeVerifier: string,
  scopes: string[] = GOOGLE_SIGN_IN_SCOPES,
): string {
  assertConfigured(oauth);
  const params = new URLSearchParams({
    client_id: oauth.clientId!,
    redirect_uri: oauth.redirectUri!,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
    code_challenge: createCodeChallenge(codeVerifier),
    code_challenge_method: 'S256',
  });
  return `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`;
}

async function postToken(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const raw = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof raw.access_token !== 'string') {
    const message =
      (typeof raw.error_description === 'string' && raw.error_description) ||
      (typeof raw.error === 'string' && raw.error) ||
      'Google rejected the token request.';
    throw new Error(message);
  }
  return GoogleTokenResponseSchema.parse(raw);
}

export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  oauth: GoogleOAuthClientConfig,
): Promise<GoogleTokenResponse> {
  assertConfigured(oauth);
  return postToken(
    new URLSearchParams({
      code,
      client_id: oauth.clientId!,
      client_secret: oauth.clientSecret!,
      redirect_uri: oauth.redirectUri!,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  );
}

export async function refreshGoogleToken(
  refreshToken: string,
  oauth: GoogleOAuthClientConfig,
): Promise<GoogleTokenResponse> {
  assertConfigured(oauth);
  return postToken(
    new URLSearchParams({
      client_id: oauth.clientId!,
      client_secret: oauth.clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  );
}

/** The OpenID userinfo endpoint. `sub` is the stable account id we key customers on. */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error('Could not read the Google profile for this account.');
  }
  return GoogleUserInfoSchema.parse(await res.json());
}

/**
 * The channel this account owns. Returns null when the account has none, which
 * the caller turns into a failed sign-in rather than a half-linked customer.
 */
export async function fetchOwnedYouTubeChannel(
  accessToken: string,
): Promise<OwnedYouTubeChannel | null> {
  const res = await fetch(YOUTUBE_OWNED_CHANNEL_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error('Could not read the YouTube channel for this account.');
  }
  const payload = (await res.json()) as {
    items?: {
      id?: string;
      snippet?: { title?: string; thumbnails?: Record<string, { url?: string }> };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }[];
  };
  const item = payload.items?.[0];
  if (!item?.id || !item.snippet?.title) return null;
  const thumbs = item.snippet.thumbnails ?? {};
  const thumbnailUrl = thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url;
  const uploadsPlaylistId = item.contentDetails?.relatedPlaylists?.uploads;
  return {
    channelId: item.id,
    title: item.snippet.title,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(uploadsPlaylistId ? { uploadsPlaylistId } : {}),
  };
}

/** Absolute expiry from Google's relative `expires_in`, in epoch millis. */
export function expiryFromExpiresIn(expiresIn: number | undefined): number | undefined {
  return expiresIn ? Date.now() + expiresIn * 1000 : undefined;
}
