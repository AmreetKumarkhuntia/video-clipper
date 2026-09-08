import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../client.js';
import { customers } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { Customer, CustomerInput } from '@lib/types/auth.js';

function rowToCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    ...(row.email ? { email: row.email } : {}),
    ...(row.name ? { name: row.name } : {}),
    ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}),
    ...(row.channelId ? { channelId: row.channelId } : {}),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export function findCustomerById(customerId: string): Customer | null {
  const done = log.dbCalled('findCustomerById', undefined, { customerId });
  const row = db.select().from(customers).where(eq(customers.id, customerId)).get();
  done({ found: row ? 1 : 0 });
  return row ? rowToCustomer(row) : null;
}

/** Which customer, if any, has already claimed this channel. Drives the 1:1 rule. */
export function findCustomerByChannelId(channelId: string): Customer | null {
  const done = log.dbCalled('findCustomerByChannelId', undefined, { channelId });
  const row = db.select().from(customers).where(eq(customers.channelId, channelId)).get();
  done({ found: row ? 1 : 0 });
  return row ? rowToCustomer(row) : null;
}

export function createCustomer(input: CustomerInput): Customer {
  const done = log.dbCalled('createCustomer', undefined, { channelId: input.channelId });
  const ts = Date.now();
  const id = `customer-${nanoid()}`;
  db.insert(customers)
    .values({
      id,
      email: input.email ?? null,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
      channelId: input.channelId ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  done({ id });
  return rowToCustomer(db.select().from(customers).where(eq(customers.id, id)).get()!);
}

/**
 * Refreshes the profile of a customer we already know.
 *
 * An omitted channel never clears an existing link — a later sign-in that cannot
 * see the channel must not unlink it.
 */
export function updateCustomerProfile(customerId: string, input: CustomerInput): Customer {
  const done = log.dbCalled('updateCustomerProfile', undefined, { customerId });
  const existing = db.select().from(customers).where(eq(customers.id, customerId)).get();
  db.update(customers)
    .set({
      email: input.email ?? existing?.email ?? null,
      name: input.name ?? existing?.name ?? null,
      avatarUrl: input.avatarUrl ?? existing?.avatarUrl ?? null,
      channelId: input.channelId ?? existing?.channelId ?? null,
      updatedAt: Date.now(),
    })
    .where(eq(customers.id, customerId))
    .run();
  done({ id: customerId });
  return rowToCustomer(db.select().from(customers).where(eq(customers.id, customerId)).get()!);
}
