import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { roles } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import { PermissionsSchema } from '@lib/types/auth.js';
import type { Permission } from '@lib/types/auth.js';

/**
 * Read-only: roles and their permissions are seed data written by the
 * migration, and a guard only ever asks what a role may do.
 */
export function findRolePermissions(roleId: string): Permission[] {
  const done = log.dbCalled('findRolePermissions', undefined, { roleId });
  const row = db
    .select({ permissions: roles.permissions })
    .from(roles)
    .where(eq(roles.id, roleId))
    .get();
  if (!row) {
    log.warn('db', 'stored role is missing; no permissions granted');
    done({ count: 0 });
    return [];
  }

  let permissions: Permission[];
  try {
    const value: unknown = JSON.parse(row.permissions);
    permissions = PermissionsSchema.parse(value);
  } catch {
    // Stored data is never copied into errors: invalid grants must fail closed.
    log.warn('db', 'stored role permissions are invalid; no permissions granted');
    done({ count: 0 });
    return [];
  }
  done({ count: permissions.length });
  return permissions;
}
