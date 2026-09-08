import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { youtubeAuth } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { YouTubeAuthInput, YouTubeAuthRecord } from '@lib/types/auth.js';

function rowToAuth(row: typeof youtubeAuth.$inferSelect): YouTubeAuthRecord {
  return {
    customerId: row.customerId,
    accessToken: row.accessToken,
    ...(row.refreshToken ? { refreshToken: row.refreshToken } : {}),
    ...(row.expiryDate ? { expiryDate: row.expiryDate } : {}),
    ...(row.scope ? { scope: row.scope } : {}),
    ...(row.channelId ? { channelId: row.channelId } : {}),
    connectedAt: new Date(row.connectedAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export function findYouTubeAuth(customerId: string): YouTubeAuthRecord | null {
  const done = log.dbCalled('findYouTubeAuth', undefined, { customerId });
  const row = db.select().from(youtubeAuth).where(eq(youtubeAuth.customerId, customerId)).get();
  done({ found: row ? 1 : 0 });
  return row ? rowToAuth(row) : null;
}

/**
 * Google returns a refresh token only on first consent, so a later sign-in must
 * not null out the stored one.
 */
export function upsertYouTubeAuth(input: YouTubeAuthInput): void {
  const done = log.dbCalled('upsertYouTubeAuth', undefined, { customerId: input.customerId });
  const ts = Date.now();
  const existing = db
    .select()
    .from(youtubeAuth)
    .where(eq(youtubeAuth.customerId, input.customerId))
    .get();
  const refreshToken = input.refreshToken ?? existing?.refreshToken ?? null;
  db.insert(youtubeAuth)
    .values({
      customerId: input.customerId,
      accessToken: input.accessToken,
      refreshToken,
      expiryDate: input.expiryDate ?? null,
      scope: input.scope ?? null,
      channelId: input.channelId ?? null,
      connectedAt: existing?.connectedAt ?? ts,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: youtubeAuth.customerId,
      set: {
        accessToken: input.accessToken,
        refreshToken,
        expiryDate: input.expiryDate ?? null,
        scope: input.scope ?? null,
        channelId: input.channelId ?? existing?.channelId ?? null,
        updatedAt: ts,
      },
    })
    .run();
  done({ customerId: input.customerId });
}

export function deleteYouTubeAuth(customerId: string): void {
  const done = log.dbCalled('deleteYouTubeAuth', undefined, { customerId });
  db.delete(youtubeAuth).where(eq(youtubeAuth.customerId, customerId)).run();
  done({ deleted: 1 });
}
