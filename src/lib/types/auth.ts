import { z } from 'zod';

/**
 * Identity and session contracts for the hosted product.
 *
 * A customer signs in with Google and is linked 1:1 to the YouTube channel that
 * account owns. Google OAuth mechanics live in `@lib/utils/googleOAuth.js`; the
 * database side lives in `@lib/orchestration/authOrchestrator.js`.
 */

// ── Google OAuth ─────────────────────────────────────────────────────────────

/** Client credentials for the sign-in flow. Injected by the app layer, never read from config here. */
export interface GoogleOAuthClientConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

/**
 * Per-request handshake values round-tripped through cookies.
 *
 * PKCE is not Google's — every OAuth provider we would add uses the same three
 * values, so this is the provider-independent name. `GoogleOAuthHandshake` is
 * kept as an alias because the Google adapter reads better with it.
 */
export interface OAuthHandshake {
  state: string;
  codeVerifier: string;
  returnTo: string;
}

export type GoogleOAuthHandshake = OAuthHandshake;

export const GoogleTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});
export type GoogleTokenResponse = z.infer<typeof GoogleTokenResponseSchema>;

/** Subset of the OpenID userinfo response we depend on. `sub` is the stable account id. */
export const GoogleUserInfoSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
});
export type GoogleUserInfo = z.infer<typeof GoogleUserInfoSchema>;

/** The channel the signed-in account owns, from `channels?part=snippet,contentDetails&mine=true`. */
export interface OwnedYouTubeChannel {
  channelId: string;
  title: string;
  thumbnailUrl?: string;
  uploadsPlaylistId?: string;
}

// ── The provider contract ────────────────────────────────────────────────────

/** Where to send the user, and what the route must persist to verify the return trip. */
export interface OAuthLoginStart {
  authUrl: string;
  handshake: OAuthHandshake;
}

/**
 * The creator account on the provider — a YouTube channel, a Twitch channel.
 *
 * Null for a provider that has no such concept, which is why nothing downstream
 * may assume one exists.
 */
export interface ProviderChannel {
  id: string;
  title: string;
}

/** Tokens as the provider issued them, normalised away from its wire shape. */
export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  scope?: string;
}

/**
 * One provider's account after normalisation.
 *
 * The shared sign-in pipeline works only in these terms, so adding a provider
 * means writing a mapper, not touching the pipeline.
 */
export interface ProviderAccount {
  /** The provider's own stable id for the account — Google's `sub`. */
  accountId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  channel: ProviderChannel | null;
  tokens: ProviderTokens;
  /** Anything provider-specific worth keeping, stored as JSON on the identity row. */
  metadata?: Record<string, unknown>;
}

// ── Customer, session, tokens ────────────────────────────────────────────────

export interface Customer {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  /**
   * The linked channel, read from the identity that provided it — there is no
   * such column on `customers`. Absent until a link completes, and for any
   * provider that has no channel concept.
   */
  channelId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Profile only. A channel is linked through the identity, never set here. */
export interface CustomerInput {
  email?: string;
  name?: string;
  avatarUrl?: string;
}

/** Sign-in methods we support. A new one is a new value, not a schema change. */
export type AuthProvider = 'google';

/** One linked login. `providerAccountId` is the provider's own stable id. */
export interface AuthIdentity {
  id: string;
  customerId: string;
  provider: AuthProvider;
  providerAccountId: string;
  createdAt: string;
  updatedAt: string;
}

/** A linked login plus what that provider handed us: tokens, channel, extras. */
export interface AuthIdentityRecord extends AuthIdentity {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
  scope?: string;
  /** The creator account on the provider. Absent when it has no such concept. */
  channelId?: string;
  metadata: Record<string, unknown>;
}

export interface AuthIdentityInput {
  customerId: string;
  provider: AuthProvider;
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
  scope?: string;
  channelId?: string;
  metadata?: Record<string, unknown>;
}

/** A session row. `id` is the sha256 of the token; the raw token only ever lives in the cookie. */
export interface SessionRecord {
  id: string;
  customerId: string;
  expiresAt: number;
  createdAt: number;
}

/** What a successful sign-in hands back to the route that must set the cookie. */
export interface SignInResult {
  customer: Customer;
  /** Raw session token — set as the cookie value, never persisted or logged. */
  token: string;
  expiresAt: number;
}

/**
 * What the caller must supply to complete a sign-in.
 *
 * `sessionTtlMs` is passed in rather than read here: nothing under
 * `src/lib/orchestration` imports the config, so lifetime policy arrives from
 * the app that owns configuration.
 */
export interface CompleteLoginOptions {
  sessionTtlMs: number;
  requestId?: string;
}

/** Per-customer Google tokens. Replaces the single-file store for the sign-in flow. */
export interface YouTubeAuthInput {
  customerId: string;
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  scope?: string;
  channelId?: string;
}

export interface YouTubeAuthRecord extends YouTubeAuthInput {
  connectedAt: string;
  updatedAt: string;
}

// ── Library ──────────────────────────────────────────────────────────────────

/** One customer's claim on a video. Ownership lives here, never on the shared `videos` row. */
export interface LibraryVideoInput {
  customerId: string;
  videoId: string;
}

export interface LibraryVideoPage {
  videos: LibraryVideoEntry[];
  total: number;
  limit: number;
  offset: number;
}

/** A saved video joined to its catalog row, shaped for the library grid. */
export interface LibraryVideoEntry {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  durationSec: number;
  thumbnailUrl?: string;
  savedAt: string;
}
