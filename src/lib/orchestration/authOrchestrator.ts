import { log } from '@lib/utils/logger.js';
import { createSessionToken, hashSessionToken } from '@lib/utils/sessionToken.js';
import {
  buildGoogleAuthUrl,
  createCodeVerifier,
  createOAuthState,
  exchangeGoogleCode,
  expiryFromExpiresIn,
  fetchGoogleUserInfo,
  fetchOwnedYouTubeChannel,
} from '@lib/utils/googleOAuth.js';
import {
  findCustomerById,
  findCustomerByChannelId,
  findCustomerIdByIdentity,
  linkIdentity,
  createCustomer,
  updateCustomerProfile,
  findValidSession,
  deleteSession,
  insertSession,
  upsertChannel,
  upsertYouTubeAuth,
} from '@lib/services/db/index.js';
import type {
  CompleteLoginOptions,
  Customer,
  GoogleOAuthClientConfig,
  GoogleOAuthHandshake,
  SignInResult,
} from '@lib/types/auth.js';

/**
 * Sign-in, session, and the 1:1 customer-to-channel link.
 *
 * The only layer allowed to combine the Google OAuth helpers with the database,
 * so every route goes through here rather than talking to repos directly.
 */

/** Mints the handshake values the start route stores in cookies, and the URL to send the user to. */
export function startGoogleLogin(
  oauth: GoogleOAuthClientConfig,
  returnTo: string,
): { authUrl: string; handshake: GoogleOAuthHandshake } {
  const handshake: GoogleOAuthHandshake = {
    state: createOAuthState(),
    codeVerifier: createCodeVerifier(),
    returnTo,
  };
  return {
    authUrl: buildGoogleAuthUrl(oauth, handshake.state, handshake.codeVerifier),
    handshake,
  };
}

/**
 * Exchanges the code, reads the profile and the owned channel, then links them.
 *
 * Rejects rather than half-linking: an account with no channel, an account whose
 * channel has moved, or a channel already claimed by someone else all throw with
 * a message meant for the user. That is why `customers.channel_id` carries no
 * UNIQUE constraint — the error is ours to word, not SQLite's.
 */
export async function completeGoogleLogin(
  code: string,
  handshake: GoogleOAuthHandshake,
  oauth: GoogleOAuthClientConfig,
  options: CompleteLoginOptions,
): Promise<SignInResult> {
  const { sessionTtlMs, requestId } = options;
  const tokens = await exchangeGoogleCode(code, handshake.codeVerifier, oauth);
  const [profile, channel] = await Promise.all([
    fetchGoogleUserInfo(tokens.access_token),
    fetchOwnedYouTubeChannel(tokens.access_token),
  ]);

  if (!channel) {
    throw new Error(
      'This Google account has no YouTube channel. Sign in with the account that owns your channel.',
    );
  }

  // Both link rules are checked before any write, so a rejected sign-in leaves no trace.
  const existingId = findCustomerIdByIdentity('google', profile.sub);
  const claimedBy = findCustomerByChannelId(channel.channelId);
  if (claimedBy && claimedBy.id !== existingId) {
    throw new Error(`${channel.title} is already linked to another account.`);
  }

  const existing = existingId ? findCustomerById(existingId) : null;
  if (existing?.channelId && existing.channelId !== channel.channelId) {
    throw new Error(
      'This account is already linked to a different YouTube channel. Sign in with the account that owns it.',
    );
  }

  log.info('auth', 'linking channel', requestId, {
    channelId: channel.channelId,
    title: channel.title,
  });

  upsertChannel({ id: channel.channelId, title: channel.title });
  const profileInput = {
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.name ? { name: profile.name } : {}),
    ...(profile.picture ? { avatarUrl: profile.picture } : {}),
    channelId: channel.channelId,
  };

  // Create then link, so a customer never exists without the identity that reached it.
  const customer = existing
    ? updateCustomerProfile(existing.id, profileInput)
    : createCustomer(profileInput);
  linkIdentity({
    customerId: customer.id,
    provider: 'google',
    providerAccountId: profile.sub,
  });

  upsertYouTubeAuth({
    customerId: customer.id,
    accessToken: tokens.access_token,
    ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    ...(expiryFromExpiresIn(tokens.expires_in) !== undefined
      ? { expiryDate: expiryFromExpiresIn(tokens.expires_in)! }
      : {}),
    ...(tokens.scope ? { scope: tokens.scope } : {}),
    channelId: channel.channelId,
  });

  const token = createSessionToken();
  const expiresAt = Date.now() + sessionTtlMs;
  insertSession(hashSessionToken(token), customer.id, expiresAt);

  return { customer, token, expiresAt };
}

/** Resolves the cookie value to a customer, or null when absent, expired, or orphaned. */
export function resolveSession(token: string | undefined): Customer | null {
  if (!token) return null;
  const session = findValidSession(hashSessionToken(token));
  if (!session) return null;
  return findCustomerById(session.customerId);
}

export function signOut(token: string | undefined): void {
  if (!token) return;
  deleteSession(hashSessionToken(token));
}
