import { and, eq, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../client.js';
import { authIdentities, customers } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { Customer, CustomerInput } from '@lib/types/auth.js';

/**
 * A customer row carries no channel — that lives on the identity that provided
 * it. `Customer.channelId` is filled in here by reading the linked identity, so
 * callers still see one object while the table stays provider-neutral.
 */

function rowToCustomer(row: typeof customers.$inferSelect, channelId: string | null): Customer {
  return {
    id: row.id,
    ...(row.email ? { email: row.email } : {}),
    ...(row.name ? { name: row.name } : {}),
    ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}),
    ...(channelId ? { channelId } : {}),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** The channel of whichever linked identity has one. 1:1 today, so the first is the only. */
function linkedChannelId(customerId: string): string | null {
  const row = db
    .select({ channelId: authIdentities.channelId })
    .from(authIdentities)
    .where(and(eq(authIdentities.customerId, customerId), isNotNull(authIdentities.channelId)))
    .get();
  return row?.channelId ?? null;
}

function load(customerId: string): Customer | null {
  const row = db.select().from(customers).where(eq(customers.id, customerId)).get();
  return row ? rowToCustomer(row, linkedChannelId(customerId)) : null;
}

export function findCustomerById(customerId: string): Customer | null {
  const done = log.dbCalled('findCustomerById', undefined, { customerId });
  const customer = load(customerId);
  done({ found: customer ? 1 : 0 });
  return customer;
}

/** Which customer, if any, has already claimed this channel. Drives the 1:1 rule. */
export function findCustomerByChannelId(channelId: string): Customer | null {
  const done = log.dbCalled('findCustomerByChannelId', undefined, { channelId });
  const row = db
    .select({ customerId: authIdentities.customerId })
    .from(authIdentities)
    .where(eq(authIdentities.channelId, channelId))
    .get();
  const customer = row ? load(row.customerId) : null;
  done({ found: customer ? 1 : 0 });
  return customer;
}

export function createCustomer(input: CustomerInput): Customer {
  const done = log.dbCalled('createCustomer', undefined, {});
  const ts = Date.now();
  const id = `customer-${nanoid()}`;
  db.insert(customers)
    .values({
      id,
      email: input.email ?? null,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  done({ id });
  return load(id)!;
}

/** Refreshes the profile of a customer we already know. Omitted fields keep their value. */
export function updateCustomerProfile(customerId: string, input: CustomerInput): Customer {
  const done = log.dbCalled('updateCustomerProfile', undefined, { customerId });
  const existing = db.select().from(customers).where(eq(customers.id, customerId)).get();
  db.update(customers)
    .set({
      email: input.email ?? existing?.email ?? null,
      name: input.name ?? existing?.name ?? null,
      avatarUrl: input.avatarUrl ?? existing?.avatarUrl ?? null,
      updatedAt: Date.now(),
    })
    .where(eq(customers.id, customerId))
    .run();
  done({ id: customerId });
  return load(customerId)!;
}
