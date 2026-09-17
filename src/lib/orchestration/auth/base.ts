import { log } from '@lib/utils/logger.js';
import { createSessionToken, hashSessionToken } from '@lib/utils/sessionToken.js';
import { SignInError } from '@lib/utils/signInError.js';
import { sql } from 'drizzle-orm';
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
  lockInitialAdminBootstrap,
  withDbTransaction,
  getDb,
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

const POSTGRES_UNIQUE_VIOLATION = '23505';
const PROVIDER_ACCOUNT_UNIQUE_CONSTRAINT = 'auth_identities_provider_account_uq';
const PROVIDER_CHANNEL_UNIQUE_CONSTRAINT = 'auth_identities_provider_channel_uq';

/** Drizzle wraps driver errors, so inspect the short cause chain for PostgreSQL details. */
function postgresUniqueConstraint(error: unknown): string | null {
  let current: unknown = error;

  for (let depth = 0; depth < 3; depth++) {
    if (typeof current !== 'object' || current === null) return null;
    const code = 'code' in current ? current.code : undefined;
    const constraint = 'constraint' in current ? current.constraint : undefined;
    if (code === POSTGRES_UNIQUE_VIOLATION && typeof constraint === 'string') {
      return constraint;
    }
    current = 'cause' in current ? current.cause : undefined;
  }

  return null;
}

/** Prevents two callbacks for one external identity from creating competing customers. */
async function lockProviderAccountClaim(
  provider: AuthProvider,
  providerAccountId: string,
): Promise<void> {
  await getDb().execute(
    sql`select pg_advisory_xact_lock(hashtext(${provider}), hashtext(${providerAccountId}))`,
  );
}

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
   * meant for the user. PostgreSQL also enforces the channel claim with a
   * partial unique index so concurrent sign-ins cannot race past this check.
   */
  async completeLogin(
    code: string,
    handshake: OAuthHandshake,
    options: CompleteLoginOptions,
  ): Promise<SignInResult> {
    const { sessionTtlMs, replacesToken, requestId } = options;
    const account = await this.fetchAccount(code, handshake);

    const persistLogin = async (): Promise<SignInResult> =>
      withDbTransaction(async () => {
        await lockProviderAccountClaim(this.id, account.accountId);

        // Both link rules are checked before any write, so a rejected sign-in leaves no trace.
        const existingId = await findCustomerIdByIdentity(this.id, account.accountId);
        if (account.channel) {
          const claimedBy = await findCustomerByChannelId(account.channel.id);
          if (claimedBy && claimedBy.id !== existingId) {
            throw new SignInError(
              'channel_claimed',
              `${account.channel.title} is already linked to another account.`,
              account.channel.title,
            );
          }
          const existing = existingId ? await findCustomerById(existingId) : null;
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
          await upsertChannel({ id: account.channel.id, title: account.channel.title });
        }

        const profile = {
          ...(account.email ? { email: account.email } : {}),
          ...(account.name ? { name: account.name } : {}),
          ...(account.avatarUrl ? { avatarUrl: account.avatarUrl } : {}),
        };

        // Create then link, so a customer never exists without the identity that reached it.
        let customer = existingId
          ? await updateCustomerProfile(existingId, profile)
          : await createCustomer(profile);

        await linkIdentity({
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
        // claim. The advisory lock serializes concurrent first sign-ins.
        const bootstrapEmail = options.initialAdminEmail?.trim().toLowerCase();
        if (
          bootstrapEmail &&
          account.emailVerified === true &&
          account.email?.trim().toLowerCase() === bootstrapEmail &&
          customer.role !== 'admin'
        ) {
          await lockInitialAdminBootstrap();
          if (!(await hasCustomerWithRole('admin'))) {
            customer = await setCustomerRole(customer.id, 'admin');
            log.info('auth', 'initial administrator assigned', requestId, {
              customerId: customer.id,
              provider: this.id,
            });
          }
        }

        // Rotation: a sign-in over an existing session retires it, so a token that
        // leaked before this point stops working now rather than at expiry.
        if (replacesToken) {
          await deleteSession(hashSessionToken(replacesToken));
          log.info('auth', 'rotated session', requestId, { customerId: customer.id });
        }
        const { token, expiresAt } = await mintSession(customer.id, sessionTtlMs);

        // Re-read so the channel just linked is on the object the route returns.
        return {
          customer: (await findCustomerById(customer.id)) ?? customer,
          token,
          expiresAt,
        };
      });

    // The advisory lock serializes callbacks from this process. Keep one bounded
    // retry for a provider-account constraint race with another writer that does
    // not take that lock; the retry reloads the identity it committed.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await persistLogin();
      } catch (error) {
        const constraint = postgresUniqueConstraint(error);
        if (account.channel && constraint === PROVIDER_CHANNEL_UNIQUE_CONSTRAINT) {
          throw new SignInError(
            'channel_claimed',
            `${account.channel.title} is already linked to another account.`,
            account.channel.title,
          );
        }
        if (attempt === 0 && constraint === PROVIDER_ACCOUNT_UNIQUE_CONSTRAINT) {
          continue;
        }
        throw error;
      }
    }

    // The loop either returns or throws. Keep an explicit terminal for type safety.
    throw new Error('Sign-in persistence retry exhausted.');
  }
}

/**
 * Mints a session for a customer we have already verified. Shared by the
 * browser flow and the CLI flow, so there is one place a session comes from.
 * The raw token is returned to the caller and only its hash is stored.
 */
export async function mintSession(
  customerId: string,
  sessionTtlMs: number,
): Promise<{ token: string; expiresAt: number }> {
  const token = createSessionToken();
  const expiresAt = Date.now() + sessionTtlMs;
  await insertSession(hashSessionToken(token), customerId, expiresAt);
  return { token, expiresAt };
}

/** Resolves the cookie value to a customer, or null when absent, expired, or orphaned. */
export async function resolveSession(token: string | undefined): Promise<Customer | null> {
  if (!token) return null;
  const session = await findValidSession(hashSessionToken(token));
  if (!session) return null;
  return await findCustomerById(session.customerId);
}

export async function signOut(token: string | undefined): Promise<void> {
  if (!token) return;
  await deleteSession(hashSessionToken(token));
}
