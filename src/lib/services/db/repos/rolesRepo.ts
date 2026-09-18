import { eq, sql } from 'drizzle-orm';
import { getDb } from '../client.js';
import { roles } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import { PermissionsSchema } from '@lib/types/auth.js';
import type { Permission } from '@lib/types/auth.js';

/**
 * Read-only: roles and their permissions are seed data written by the
 * migration, and a guard only ever asks what a role may do.
 */
export async function findRolePermissions(roleId: string): Promise<Permission[]> {
  const done = log.dbCalled('findRolePermissions', undefined, { roleId });
  const [row] = await getDb()
    .select({ permissions: roles.permissions })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);
  if (!row) {
    log.warn('db', 'stored role is missing; no permissions granted');
    done({ count: 0 });
    return [];
  }

  let permissions: Permission[];
  try {
    permissions = PermissionsSchema.parse(row.permissions);
  } catch {
    // Stored data is never copied into errors: invalid grants must fail closed.
    log.warn('db', 'stored role permissions are invalid; no permissions granted');
    done({ count: 0 });
    return [];
  }
  done({ count: permissions.length });
  return permissions;
}

/** Serializes the one-time initial-admin decision within the surrounding transaction. */
export async function lockInitialAdminBootstrap(): Promise<void> {
  await getDb().execute(sql`select pg_advisory_xact_lock(hashtext('video-clipper-initial-admin'))`);
}
