import { createHash } from 'crypto';
import {
  YouTubeAuthStateSchema,
  YouTubeAuthStatusSchema,
  type SaveYouTubeManualAuthRequest,
  type YouTubeAuthState,
  type YouTubeAuthStatus,
  type YouTubeChannel,
  type YouTubeOAuthClientConfig,
  type OAuthCookieState,
} from '@lib/types/publish.js';
import { clearYouTubeAuthState, loadYouTubeAuthState, saveYouTubeAuthState } from './authStore.js';
import { log } from '@lib/utils/logger.js';
import { sanitizeLogValue } from '@lib/utils/format.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const YOUTUBE_CHANNELS_URL =
  'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true';
const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ');

export async function getYouTubeAuthStatus(
  oauth: YouTubeOAuthClientConfig,
): Promise<YouTubeAuthStatus> {
  const auth = await loadYouTubeAuthState();
  const oauthConfigured = isOAuthConfigured(oauth);

  if (!auth) {
    return YouTubeAuthStatusSchema.parse({ connected: false, oauthConfigured });
  }

  return YouTubeAuthStatusSchema.parse({
    connected: true,
    oauthConfigured,
    channel: auth.channel,
    connectedAt: auth.connectedAt,
    expiresAt: auth.expiryDate,
    hasRefreshToken: Boolean(auth.refreshToken),
    authMode: auth.authMode,
  });
}

export async function saveManualYouTubeAuth(
  input: SaveYouTubeManualAuthRequest,
  oauth: YouTubeOAuthClientConfig,
): Promise<YouTubeAuthStatus> {
  const channel = await fetchOwnedChannel(input.accessToken);

  const state = YouTubeAuthStateSchema.parse({
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    expiryDate: input.expiryDate,
    connectedAt: new Date().toISOString(),
    authMode: 'manual',
    channel,
  });

  await saveYouTubeAuthState(state);
  return getYouTubeAuthStatus(oauth);
}

export async function disconnectYouTubeAuth(): Promise<void> {
  await clearYouTubeAuthState();
}

export function buildYouTubeOAuthAuthorizationUrl(
  cookieState: OAuthCookieState,
  oauth: YouTubeOAuthClientConfig,
): string {
  if (!isOAuthConfigured(oauth)) {
    throw new Error(
      'Configure YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET, and YOUTUBE_OAUTH_REDIRECT_URI before connecting YouTube.',
    );
  }

  const url = new URL(GOOGLE_AUTH_BASE_URL);
  url.searchParams.set('client_id', oauth.clientId!);
  url.searchParams.set('redirect_uri', oauth.redirectUri!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', cookieState.state);
  url.searchParams.set('code_challenge', createCodeChallenge(cookieState.codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export async function completeYouTubeOAuthCallback(
  code: string,
  cookieState: OAuthCookieState,
  oauth: YouTubeOAuthClientConfig,
): Promise<YouTubeAuthStatus> {
  if (!isOAuthConfigured(oauth)) {
    throw new Error(
      'Configure YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET, and YOUTUBE_OAUTH_REDIRECT_URI before connecting YouTube.',
    );
  }

  const existing = await loadYouTubeAuthState();
  const body = new URLSearchParams({
    code,
    client_id: oauth.clientId!,
    client_secret: oauth.clientSecret!,
    redirect_uri: oauth.redirectUri!,
    grant_type: 'authorization_code',
    code_verifier: cookieState.codeVerifier,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  const raw = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !raw.access_token) {
    throw new Error(raw.error_description || raw.error || 'Failed to complete YouTube OAuth.');
  }

  const channel = await fetchOwnedChannel(raw.access_token);

  await saveYouTubeAuthState(
    YouTubeAuthStateSchema.parse({
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token ?? existing?.refreshToken,
      expiryDate: raw.expires_in ? Date.now() + raw.expires_in * 1000 : undefined,
      scope: raw.scope ?? existing?.scope,
      connectedAt: new Date().toISOString(),
      authMode: 'oauth',
      channel,
    }),
  );

  return getYouTubeAuthStatus(oauth);
}

export async function getAuthorizedYouTubeAuthState(
  oauth: YouTubeOAuthClientConfig,
  requestId?: string,
): Promise<YouTubeAuthState> {
  const auth = await loadYouTubeAuthState();

  if (!auth) {
    log.warn('getAuthorizedYouTubeAuthState', 'no auth state found', requestId, {
      status: 'missing',
    });
    throw new Error('Connect a YouTube account before publishing clips.');
  }

  log.info('getAuthorizedYouTubeAuthState', 'auth state loaded', requestId, {
    status: 'loaded',
    authMode: auth.authMode,
    channelId: auth.channel.channelId,
    hasRefreshToken: Boolean(auth.refreshToken),
  });

  return ensureFreshAccessToken(auth, oauth, requestId);
}

export function isOAuthConfigured(oauth: YouTubeOAuthClientConfig): boolean {
  return Boolean(oauth.clientId?.trim() && oauth.clientSecret?.trim() && oauth.redirectUri?.trim());
}

async function ensureFreshAccessToken(
  auth: YouTubeAuthState,
  oauth: YouTubeOAuthClientConfig,
  requestId?: string,
): Promise<YouTubeAuthState> {
  if (!isExpiredOrMissing(auth.expiryDate)) {
    log.info('ensureFreshAccessToken', 'reusing token', requestId, {
      action: 'reuse',
      authMode: auth.authMode,
      expiresAt: auth.expiryDate ?? 'none',
    });
    return auth;
  }

  const credentials = resolveOAuthClientCredentials(auth, oauth);

  if (!auth.refreshToken || !credentials) {
    log.warn('ensureFreshAccessToken', 'refresh skipped', requestId, {
      action: 'refresh-skipped',
      hasRefreshToken: Boolean(auth.refreshToken),
      hasCredentials: Boolean(credentials),
    });
    return auth;
  }

  log.info('ensureFreshAccessToken', 'refreshing token', requestId, {
    action: 'refresh-start',
    authMode: auth.authMode,
    channelId: auth.channel.channelId,
  });

  const refreshed = await refreshAccessToken(auth, credentials, requestId);
  await saveYouTubeAuthState(refreshed);
  log.info('ensureFreshAccessToken', 'token refreshed', requestId, {
    action: 'refresh-success',
    authMode: refreshed.authMode,
    expiresAt: refreshed.expiryDate ?? 'none',
  });
  return refreshed;
}

async function refreshAccessToken(
  auth: YouTubeAuthState,
  credentials: { clientId: string; clientSecret: string },
  requestId?: string,
): Promise<YouTubeAuthState> {
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: auth.refreshToken ?? '',
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  const raw = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !raw.access_token) {
    log.warn('refreshAccessToken', 'token refresh failed', requestId, {
      action: 'refresh-failed',
      status: res.status,
      error: sanitizeLogValue(raw.error_description || raw.error || 'unknown'),
    });
    throw new Error(
      raw.error_description || raw.error || 'Failed to refresh YouTube access token.',
    );
  }

  return YouTubeAuthStateSchema.parse({
    ...auth,
    accessToken: raw.access_token,
    expiryDate: raw.expires_in ? Date.now() + raw.expires_in * 1000 : auth.expiryDate,
    scope: raw.scope ?? auth.scope,
  });
}

async function fetchOwnedChannel(accessToken: string): Promise<YouTubeChannel> {
  const res = await fetch(YOUTUBE_CHANNELS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const raw = (await res.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        thumbnails?: {
          default?: { url?: string };
          medium?: { url?: string };
          high?: { url?: string };
        };
      };
    }>;
    error?: {
      message?: string;
    };
  };

  if (!res.ok) {
    throw new Error(raw.error?.message || 'Failed to validate YouTube access token.');
  }

  const item = raw.items?.[0];

  if (!item?.id || !item.snippet?.title) {
    throw new Error('The provided YouTube token did not return an owned channel.');
  }

  return {
    channelId: item.id,
    title: item.snippet.title,
    thumbnailUrl:
      item.snippet.thumbnails?.high?.url ||
      item.snippet.thumbnails?.medium?.url ||
      item.snippet.thumbnails?.default?.url,
  };
}

function isExpiredOrMissing(expiryDate: number | undefined): boolean {
  if (!expiryDate) return false;
  return Date.now() >= expiryDate - 60_000;
}

function createCodeChallenge(codeVerifier: string): string {
  return toBase64Url(createHash('sha256').update(codeVerifier).digest());
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function resolveOAuthClientCredentials(
  auth: YouTubeAuthState,
  oauth: YouTubeOAuthClientConfig,
): { clientId: string; clientSecret: string } | null {
  const clientId = auth.clientId ?? oauth.clientId;
  const clientSecret = auth.clientSecret ?? oauth.clientSecret;

  if (!clientId?.trim() || !clientSecret?.trim()) {
    return null;
  }

  return { clientId, clientSecret };
}
