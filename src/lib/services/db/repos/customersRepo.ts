import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb, withDbTransaction } from '../client.js';
import { authIdentities, customers } from '../schema.js';
import { findRolePermissions } from './rolesRepo.js';
import { log } from '@lib/utils/logger.js';
import type { Customer, CustomerInput, Permission, Role } from '@lib/types/auth.js';

/**
 * A customer row carries no channel — that lives on the identity that provided
 * it. `Customer.channelId` is filled in here by reading the linked identity, so
 * callers still see one object while the table stays provider-neutral.
 */

function rowToCustomer(
  row: typeof customers.$inferSelect,
  channelId: string | null,
  permissions: Permission[],
): Customer {
  return {
    id: row.id,
    ...(row.email ? { email: row.email } : {}),
    ...(row.name ? { name: row.name } : {}),
    ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}),
    ...(channelId ? { channelId } : {}),
    role: row.roleId as Role,
    permissions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The channel of whichever linked identity has one. 1:1 today; should a second
 * identity ever carry a channel, the most recently refreshed one wins rather
 * than an arbitrary matching row.
 */
async function linkedChannelId(customerId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ channelId: authIdentities.channelId })
    .from(authIdentities)
    .where(and(eq(authIdentities.customerId, customerId), isNotNull(authIdentities.channelId)))
    .orderBy(desc(authIdentities.updatedAt))
    .limit(1);
  return row?.channelId ?? null;
}

async function load(customerId: string): Promise<Customer | null> {
  const [row] = await getDb().select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!row) return null;
  const [channelId, permissions] = await Promise.all([
    linkedChannelId(customerId),
    findRolePermissions(row.roleId),
  ]);
  return rowToCustomer(row, channelId, permissions);
}

export async function findCustomerById(customerId: string): Promise<Customer | null> {
  const done = log.dbCalled('findCustomerById', undefined, { customerId });
  const customer = await load(customerId);
  done({ found: customer ? 1 : 0 });
  return customer;
}

/** Which customer, if any, has already claimed this channel. Drives the 1:1 rule. */
export async function findCustomerByChannelId(channelId: string): Promise<Customer | null> {
  const done = log.dbCalled('findCustomerByChannelId', undefined, { channelId });
  const [row] = await getDb()
    .select({ customerId: authIdentities.customerId })
    .from(authIdentities)
    .where(eq(authIdentities.channelId, channelId))
    .limit(1);
  const customer = row ? await load(row.customerId) : null;
  done({ found: customer ? 1 : 0 });
  return customer;
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const done = log.dbCalled('createCustomer', undefined, {});
  const ts = new Date();
  const id = `customer-${nanoid()}`;
  const customer = await withDbTransaction(async () => {
    await getDb()
      .insert(customers)
      .values({
        id,
        email: input.email ?? null,
        name: input.name ?? null,
        avatarUrl: input.avatarUrl ?? null,
        createdAt: ts,
        updatedAt: ts,
      })
      .returning({ id: customers.id });
    return (await load(id))!;
  });
  done({ id });
  return customer;
}

/** Refreshes the profile of a customer we already know. Omitted fields keep their value. */
export async function updateCustomerProfile(
  customerId: string,
  input: CustomerInput,
): Promise<Customer> {
  const done = log.dbCalled('updateCustomerProfile', undefined, { customerId });
  const customer = await withDbTransaction(async () => {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    await db
      .update(customers)
      .set({
        email: input.email ?? existing?.email ?? null,
        name: input.name ?? existing?.name ?? null,
        avatarUrl: input.avatarUrl ?? existing?.avatarUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId))
      .returning({ id: customers.id });
    return (await load(customerId))!;
  });
  done({ id: customerId });
  return customer;
}

/** Promotion and demotion. Takes effect on the next request — the role is read on every session resolve. */
export async function setCustomerRole(customerId: string, role: Role): Promise<Customer> {
  const done = log.dbCalled('setCustomerRole', undefined, { customerId, role });
  const customer = await withDbTransaction(async () => {
    await getDb()
      .update(customers)
      .set({ roleId: role, updatedAt: new Date() })
      .where(eq(customers.id, customerId))
      .returning({ id: customers.id });
    return (await load(customerId))!;
  });
  done({ id: customerId });
  return customer;
}

export async function hasCustomerWithRole(role: Role): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.roleId, role))
    .limit(1);
  return row !== undefined;
}
