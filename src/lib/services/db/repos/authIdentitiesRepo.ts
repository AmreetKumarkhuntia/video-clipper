import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../client.js';
import { authIdentities } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { AuthIdentityInput, AuthProvider } from '@lib/types/auth.js';

/**
 * The bridge between a person and a way of signing in.
 *
 * Keeping it out of `customers` is what lets a second provider be added without
 * touching the identity table, and lets one person hold several logins.
 */

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

/** Idempotent: signing in again re-links the same pair rather than duplicating it. */
export function linkIdentity(input: AuthIdentityInput): void {
  const done = log.dbCalled('linkIdentity', undefined, {
    customerId: input.customerId,
    provider: input.provider,
  });
  const ts = Date.now();
  db.insert(authIdentities)
    .values({
      id: `identity-${nanoid()}`,
      customerId: input.customerId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      createdAt: ts,
      updatedAt: ts,
    })
    .onConflictDoNothing()
    .run();
  done({ customerId: input.customerId });
}
