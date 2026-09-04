import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../client.js';
import { authIdentities } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { AuthIdentityInput, AuthIdentityRecord, AuthProvider } from '@lib/types/auth.js';

/**
 * The bridge between a person and a way of signing in, and the store for
 * whatever that sign-in handed us.
 *
 * Keeping all of it here is what lets a second provider be added without a new
 * table and without touching `customers`.
 */

function rowToIdentity(row: typeof authIdentities.$inferSelect): AuthIdentityRecord {
  return {
    id: row.id,
    customerId: row.customerId,
    provider: row.provider as AuthProvider,
    providerAccountId: row.providerAccountId,
    ...(row.accessToken ? { accessToken: row.accessToken } : {}),
    ...(row.refreshToken ? { refreshToken: row.refreshToken } : {}),
    ...(row.expiryDate ? { expiryDate: row.expiryDate } : {}),
    ...(row.scope ? { scope: row.scope } : {}),
    ...(row.channelId ? { channelId: row.channelId } : {}),
    metadata: safeParse(row.metadata),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
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
 * Two fields survive an update that omits them. A provider returns a refresh
 * token only on first consent, so a later sign-in must not blank it; and a
 * sign-in that cannot see the channel must not unlink it.
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

  const values = {
    customerId: input.customerId,
    accessToken: input.accessToken ?? null,
    refreshToken: input.refreshToken ?? existing?.refreshToken ?? null,
    expiryDate: input.expiryDate ?? null,
    scope: input.scope ?? null,
    channelId: input.channelId ?? existing?.channelId ?? null,
    metadata: JSON.stringify(input.metadata ?? safeParse(existing?.metadata ?? '{}')),
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
