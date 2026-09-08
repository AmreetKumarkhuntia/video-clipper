import { eq, lt } from 'drizzle-orm';
import { db } from '../client.js';
import { sessions } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { SessionRecord } from '@lib/types/auth.js';

/**
 * `id` is the sha256 of the session token. Callers hash before calling; the raw
 * token exists only in the cookie and must never be passed here or logged.
 */
export function insertSession(idHash: string, customerId: string, expiresAt: number): void {
  const done = log.dbCalled('insertSession', undefined, { customerId });
  db.insert(sessions).values({ id: idHash, customerId, expiresAt, createdAt: Date.now() }).run();
  done({ created: 1 });
}

/** Returns the session only while it is unexpired. Expired rows are left in place. */
export function findValidSession(idHash: string): SessionRecord | null {
  const done = log.dbCalled('findValidSession', undefined, { hashPrefix: idHash.slice(0, 8) });
  const row = db.select().from(sessions).where(eq(sessions.id, idHash)).get();
  if (!row || row.expiresAt <= Date.now()) {
    done({ found: 0 });
    return null;
  }
  done({ found: 1 });
  return {
    id: row.id,
    customerId: row.customerId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export function deleteSession(idHash: string): void {
  const done = log.dbCalled('deleteSession', undefined, { hashPrefix: idHash.slice(0, 8) });
  db.delete(sessions).where(eq(sessions.id, idHash)).run();
  done({ deleted: 1 });
}

export function deleteExpiredSessions(now = Date.now()): void {
  const done = log.dbCalled('deleteExpiredSessions', undefined, {});
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
  done({});
}
