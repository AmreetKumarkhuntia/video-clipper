import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../client.js';
import { libraryVideos, videos } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { LibraryVideoEntry, LibraryVideoInput, LibraryVideoPage } from '@lib/types/auth.js';

/**
 * A customer's saved videos. Ownership lives only here — the `videos` table stays
 * a shared catalog keyed by YouTube video id and is written by the CLI too.
 */

/** Idempotent: re-adding an already-saved video is a no-op, guarded by the composite unique index. */
export function saveLibraryVideo(input: LibraryVideoInput): void {
  const done = log.dbCalled('saveLibraryVideo', undefined, {
    customerId: input.customerId,
    videoId: input.videoId,
  });
  const ts = Date.now();
  db.insert(libraryVideos)
    .values({
      id: `lib-${nanoid()}`,
      customerId: input.customerId,
      videoId: input.videoId,
      savedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    })
    .onConflictDoNothing()
    .run();
  done({ videoId: input.videoId });
}

export function removeLibraryVideo(customerId: string, videoId: string): void {
  const done = log.dbCalled('removeLibraryVideo', undefined, { customerId, videoId });
  db.delete(libraryVideos)
    .where(and(eq(libraryVideos.customerId, customerId), eq(libraryVideos.videoId, videoId)))
    .run();
  done({ deleted: 1 });
}

/** Which of `videoIds` this customer has already saved. Marks Add vs Added on the browse grid. */
export function findSavedVideoIds(customerId: string, videoIds: string[]): string[] {
  const done = log.dbCalled('findSavedVideoIds', undefined, {
    customerId,
    count: videoIds.length,
  });
  if (videoIds.length === 0) {
    done({ found: 0 });
    return [];
  }
  const rows = db
    .select({ videoId: libraryVideos.videoId })
    .from(libraryVideos)
    .where(and(eq(libraryVideos.customerId, customerId), inArray(libraryVideos.videoId, videoIds)))
    .all();
  done({ found: rows.length });
  return rows.map((r) => r.videoId);
}

/** One page of the library, newest save first, joined to the catalog row. */
export function listLibraryVideos(
  customerId: string,
  limit: number,
  offset: number,
): LibraryVideoPage {
  const done = log.dbCalled('listLibraryVideos', undefined, { customerId, limit, offset });
  const rows = db
    .select({ saved: libraryVideos, video: videos })
    .from(libraryVideos)
    .innerJoin(videos, eq(libraryVideos.videoId, videos.id))
    .where(eq(libraryVideos.customerId, customerId))
    .orderBy(desc(libraryVideos.savedAt))
    .limit(limit)
    .offset(offset)
    .all();
  const totalRow = db
    .select({ value: count() })
    .from(libraryVideos)
    .where(eq(libraryVideos.customerId, customerId))
    .get();
  const entries: LibraryVideoEntry[] = rows.map(({ saved, video }) => ({
    videoId: video.id,
    title: video.title,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    publishedAt: video.publishedAt,
    durationSec: video.durationSec,
    ...(video.thumbnailUrl ? { thumbnailUrl: video.thumbnailUrl } : {}),
    savedAt: new Date(saved.savedAt).toISOString(),
  }));
  done({ count: entries.length });
  return { videos: entries, total: totalRow?.value ?? 0, limit, offset };
}
