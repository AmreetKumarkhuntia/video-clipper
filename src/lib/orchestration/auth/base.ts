import { log } from '@lib/utils/logger.js';
import { createSessionToken, hashSessionToken } from '@lib/utils/sessionToken.js';
import { SignInError } from '@lib/utils/signInError.js';
import {
  findCustomerById,
  findCustomerByChannelId,
  hasCustomerWithRole,
  findCustomerIdByIdentity,
  linkIdentity,
  createCustomer,
  updateCustomerProfile,
  findValidSession,
  deleteSession,
  insertSession,
  setCustomerRole,
  upsertChannel,
} from '@lib/services/db/index.js';
import type {
  AuthProvider,
  CompleteLoginOptions,
  Customer,
  OAuthHandshake,
  OAuthLoginStart,
  ProviderAccount,
  SignInResult,
} from '@lib/types/auth.js';

/**
 * The provider-independent half of sign-in.
 *
 * Everything `completeLogin` does is true of any OAuth provider: enforce the
 * link rules, upsert the customer, link the identity with whatever tokens came
 * back, and mint a session. A provider subclass supplies only the two steps
 * that genuinely differ — building the consent URL, and turning a callback code
 * into a `ProviderAccount`.
 *
 * Adding Twitch is therefore a new subclass and a new `AuthProvider` value,
 * with nothing here to change.
 */
export abstract class BaseOAuthProvider {
  /** The value stored in `auth_identities.provider`. */
  abstract readonly id: AuthProvider;

  /** Builds the consent URL and the handshake the route stores in cookies. */
  abstract startLogin(returnTo: string): OAuthLoginStart;

  /** Exchanges the callback code and normalises whatever this provider returns. */
  protected abstract fetchAccount(
    code: string,
    handshake: OAuthHandshake,
  ): Promise<ProviderAccount>;

  /**
   * Rejects rather than half-linking: a channel already claimed by someone
   * else, or an account whose channel has moved, both throw with a message
   * meant for the user. That is why the channel carries no UNIQUE constraint —
   * the error is ours to word, not SQLite's.
   */
  async completeLogin(
    code: string,
    handshake: OAuthHandshake,
    options: CompleteLoginOptions,
  ): Promise<SignInResult> {
    const { sessionTtlMs, replacesToken, requestId } = options;
    const account = await this.fetchAccount(code, handshake);

    // Both link rules are checked before any write, so a rejected sign-in leaves no trace.
    const existingId = findCustomerIdByIdentity(this.id, account.accountId);
    if (account.channel) {
      const claimedBy = findCustomerByChannelId(account.channel.id);
      if (claimedBy && claimedBy.id !== existingId) {
        throw new SignInError(
          'channel_claimed',
          `${account.channel.title} is already linked to another account.`,
          account.channel.title,
        );
      }
      const existing = existingId ? findCustomerById(existingId) : null;
      if (existing?.channelId && existing.channelId !== account.channel.id) {
        throw new SignInError(
          'channel_mismatch',
          'This account is already linked to a different channel. Sign in with the account that owns it.',
        );
      }
      log.info('auth', 'linking channel', requestId, {
        provider: this.id,
        channelId: account.channel.id,
        title: account.channel.title,
      });
      upsertChannel({ id: account.channel.id, title: account.channel.title });
    }

    const profile = {
      ...(account.email ? { email: account.email } : {}),
      ...(account.name ? { name: account.name } : {}),
      ...(account.avatarUrl ? { avatarUrl: account.avatarUrl } : {}),
    };

    // Create then link, so a customer never exists without the identity that reached it.
    let customer = existingId
      ? updateCustomerProfile(existingId, profile)
      : createCustomer(profile);

    linkIdentity({
      customerId: customer.id,
      provider: this.id,
      providerAccountId: account.accountId,
      accessToken: account.tokens.accessToken,
      ...(account.tokens.refreshToken ? { refreshToken: account.tokens.refreshToken } : {}),
      ...(account.tokens.expiryDate ? { expiryDate: account.tokens.expiryDate } : {}),
      ...(account.tokens.scope ? { scope: account.tokens.scope } : {}),
      ...(account.channel ? { channelId: account.channel.id } : {}),
      ...(account.metadata ? { metadata: account.metadata } : {}),
    });

    // Bootstrap is deployment-controlled and requires Google's verified email
    // claim. A customer cannot grant this to themselves through an app route.
    const bootstrapEmail = options.initialAdminEmail?.trim().toLowerCase();
    if (
      bootstrapEmail &&
      account.emailVerified === true &&
      account.email?.trim().toLowerCase() === bootstrapEmail &&
      customer.role !== 'admin' &&
      !hasCustomerWithRole('admin')
    ) {
      customer = setCustomerRole(customer.id, 'admin');
      log.info('auth', 'initial administrator assigned', requestId, {
        customerId: customer.id,
        provider: this.id,
      });
    }

    // Rotation: a sign-in over an existing session retires it, so a token that
    // leaked before this point stops working now rather than at expiry.
    if (replacesToken) {
      deleteSession(hashSessionToken(replacesToken));
      log.info('auth', 'rotated session', requestId, { customerId: customer.id });
    }
    const { token, expiresAt } = mintSession(customer.id, sessionTtlMs);

    // Re-read so the channel just linked is on the object the route returns.
    return { customer: findCustomerById(customer.id) ?? customer, token, expiresAt };
  }
}

/**
 * Mints a session for a customer we have already verified. Shared by the
 * browser flow and the CLI flow, so there is one place a session comes from.
 * The raw token is returned to the caller and only its hash is stored.
 */
export function mintSession(
  customerId: string,
  sessionTtlMs: number,
): { token: string; expiresAt: number } {
  const token = createSessionToken();
  const expiresAt = Date.now() + sessionTtlMs;
  insertSession(hashSessionToken(token), customerId, expiresAt);
  return { token, expiresAt };
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
