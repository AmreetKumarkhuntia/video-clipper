import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../client.js';
import { authIdentities } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import { decryptSecret, encryptSecret, isEncryptedSecret } from '@lib/services/encryption/index.js';
import type { AuthIdentityInput, AuthIdentityRecord, AuthProvider } from '@lib/types/auth.js';

/**
 * The bridge between a person and a way of signing in, and the store for
 * whatever that sign-in handed us.
 *
 * Keeping all of it here is what lets a second provider be added without a new
 * table and without touching `customers`.
 */

function rowToIdentity(row: typeof authIdentities.$inferSelect): AuthIdentityRecord {
  const accessToken = readSecret(row.accessToken, row.id);
  const refreshToken = readSecret(row.refreshToken, row.id);
  return {
    id: row.id,
    customerId: row.customerId,
    provider: row.provider as AuthProvider,
    providerAccountId: row.providerAccountId,
    ...(accessToken ? { accessToken } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    ...(row.expiryDate ? { expiryDate: row.expiryDate } : {}),
    ...(row.scope ? { scope: row.scope } : {}),
    ...(row.channelId ? { channelId: row.channelId } : {}),
    metadata: safeParse(row.metadata),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * A token that cannot be decrypted — the key changed, or the row was edited
 * — reads as no token rather than failing sign-in. The customer re-consents on
 * their next sign-in and the row is rewritten; nothing else can be done with it.
 */
function readSecret(stored: string | null, rowId: string): string | undefined {
  if (!stored) return undefined;
  try {
    return decryptSecret(stored);
  } catch (error) {
    log.warn('db', 'identity token unreadable, treating as absent', undefined, {
      identityId: rowId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

function writeSecret(plain: string | undefined | null): string | null {
  return plain ? encryptSecret(plain) : null;
}

/** A hand-edited row must not crash sign-in, so a bad blob reads as no metadata. */
function safeParse(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The customer this login belongs to, or null when the login is unknown to us. */
export function findCustomerIdByIdentity(
  provider: AuthProvider,
  providerAccountId: string,
): string | null {
  const done = log.dbCalled('findCustomerIdByIdentity', undefined, { provider });
  const row = db
    .select({ customerId: authIdentities.customerId })
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.provider, provider),
        eq(authIdentities.providerAccountId, providerAccountId),
      ),
    )
    .get();
  done({ found: row ? 1 : 0 });
  return row?.customerId ?? null;
}

/** One customer's login with a given provider, tokens included. */
export function findIdentity(
  customerId: string,
  provider: AuthProvider,
): AuthIdentityRecord | null {
  const done = log.dbCalled('findIdentity', undefined, { customerId, provider });
  const row = db
    .select()
    .from(authIdentities)
    .where(and(eq(authIdentities.customerId, customerId), eq(authIdentities.provider, provider)))
    .get();
  done({ found: row ? 1 : 0 });
  return row ? rowToIdentity(row) : null;
}

/**
 * Idempotent: signing in again updates the same row rather than duplicating it.
 *
 * Three fields survive an update that omits them. A provider returns a refresh
 * token only on first consent, so a later sign-in must not blank it; a sign-in
 * that cannot see the channel must not unlink it; and metadata merges key by
 * key, so a sign-in where the provider omits one detail (say, the uploads
 * playlist) keeps what an earlier sign-in stored.
 */
export function linkIdentity(input: AuthIdentityInput): void {
  const done = log.dbCalled('linkIdentity', undefined, {
    customerId: input.customerId,
    provider: input.provider,
  });
  const ts = Date.now();
  const existing = db
    .select()
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.provider, input.provider),
        eq(authIdentities.providerAccountId, input.providerAccountId),
      ),
    )
    .get();

  // Every write goes through the cipher, including the refresh token kept from
  // an earlier grant — which is what re-encrypts a row written before
  // encryption existed the next time its owner signs in.
  const values = {
    customerId: input.customerId,
    accessToken: writeSecret(input.accessToken),
    refreshToken: writeSecret(
      input.refreshToken ?? readSecret(existing?.refreshToken ?? null, existing?.id ?? ''),
    ),
    expiryDate: input.expiryDate ?? null,
    scope: input.scope ?? null,
    channelId: input.channelId ?? existing?.channelId ?? null,
    metadata: JSON.stringify({
      ...safeParse(existing?.metadata ?? '{}'),
      ...(input.metadata ?? {}),
    }),
    updatedAt: ts,
  };

  if (existing) {
    db.update(authIdentities).set(values).where(eq(authIdentities.id, existing.id)).run();
  } else {
    db.insert(authIdentities)
      .values({
        id: `identity-${nanoid()}`,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        createdAt: ts,
        ...values,
      })
      .run();
  }
  done({ customerId: input.customerId });
}

/** Forgets a login and the tokens it carried. */
export function unlinkIdentity(customerId: string, provider: AuthProvider): void {
  const done = log.dbCalled('unlinkIdentity', undefined, { customerId, provider });
  db.delete(authIdentities)
    .where(and(eq(authIdentities.customerId, customerId), eq(authIdentities.provider, provider)))
    .run();
  done({ customerId });
}

/**
 * One-time sweep at startup: rows written before encryption existed are
 * rewritten through the cipher. Idempotent, and cheap when there is nothing
 * to do. Returns how many rows changed.
 */
export function reencryptIdentityTokens(): number {
  const done = log.dbCalled('reencryptIdentityTokens', undefined, {});
  const rows = db.select().from(authIdentities).all();
  let changed = 0;
  for (const row of rows) {
    const needsAccess = row.accessToken !== null && !isEncryptedSecret(row.accessToken);
    const needsRefresh = row.refreshToken !== null && !isEncryptedSecret(row.refreshToken);
    if (!needsAccess && !needsRefresh) continue;
    db.update(authIdentities)
      .set({
        ...(needsAccess ? { accessToken: encryptSecret(row.accessToken!) } : {}),
        ...(needsRefresh ? { refreshToken: encryptSecret(row.refreshToken!) } : {}),
      })
      .where(eq(authIdentities.id, row.id))
      .run();
    changed++;
  }
  done({ changed });
  return changed;
}

/** Reports whether the database contains tokens protected by the deployment key. */
export function hasEncryptedIdentityTokens(): boolean {
  const rows = db
    .select({ accessToken: authIdentities.accessToken, refreshToken: authIdentities.refreshToken })
    .from(authIdentities)
    .all();
  return rows.some(
    (row) =>
      (row.accessToken !== null && isEncryptedSecret(row.accessToken)) ||
      (row.refreshToken !== null && isEncryptedSecret(row.refreshToken)),
  );
}

/**
 * Fails startup for a wrong key or malformed encrypted value. Normal reads may
 * degrade an individual identity to "no token"; startup must not silently do
 * that for an entire restored database.
 */
export function validateEncryptedIdentityTokens(): void {
  const rows = db
    .select({
      id: authIdentities.id,
      accessToken: authIdentities.accessToken,
      refreshToken: authIdentities.refreshToken,
    })
    .from(authIdentities)
    .all();

  for (const row of rows) {
    for (const stored of [row.accessToken, row.refreshToken]) {
      if (!stored || !isEncryptedSecret(stored)) continue;
      try {
        decryptSecret(stored);
      } catch (cause) {
        throw new Error(`Encrypted provider token on identity ${row.id} cannot be decrypted.`, {
          cause,
        });
      }
    }
  }
}
