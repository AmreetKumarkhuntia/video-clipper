import { eq, lt } from 'drizzle-orm';
import { getDb } from '../client.js';
import { sessions } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { SessionRecord } from '@lib/types/auth.js';

/**
 * `id` is the sha256 of the session token. Callers hash before calling; the raw
 * token exists only in the cookie and must never be passed here or logged.
 */
export async function insertSession(
  idHash: string,
  customerId: string,
  expiresAt: number,
): Promise<void> {
  const done = log.dbCalled('insertSession', undefined, { customerId });
  await getDb()
    .insert(sessions)
    .values({ id: idHash, customerId, expiresAt: new Date(expiresAt), createdAt: new Date() })
    .returning({ id: sessions.id });
  done({ created: 1 });
}

/** Returns the session only while it is unexpired. Expired rows are left in place. */
export async function findValidSession(idHash: string): Promise<SessionRecord | null> {
  const done = log.dbCalled('findValidSession', undefined, { hashPrefix: idHash.slice(0, 8) });
  const [row] = await getDb().select().from(sessions).where(eq(sessions.id, idHash)).limit(1);
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    done({ found: 0 });
    return null;
  }
  done({ found: 1 });
  return {
    id: row.id,
    customerId: row.customerId,
    expiresAt: row.expiresAt.getTime(),
    createdAt: row.createdAt.getTime(),
  };
}

export async function deleteSession(idHash: string): Promise<void> {
  const done = log.dbCalled('deleteSession', undefined, { hashPrefix: idHash.slice(0, 8) });
  await getDb().delete(sessions).where(eq(sessions.id, idHash)).returning({ id: sessions.id });
  done({ deleted: 1 });
}

export async function deleteExpiredSessions(now = Date.now()): Promise<void> {
  const done = log.dbCalled('deleteExpiredSessions', undefined, {});
  await getDb()
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date(now)))
    .returning({ id: sessions.id });
  done({});
}
