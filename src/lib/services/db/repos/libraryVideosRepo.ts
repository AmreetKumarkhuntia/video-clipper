import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../client.js';
import { libraryVideos, videos } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { LibraryVideoEntry, LibraryVideoInput, LibraryVideoPage } from '@lib/types/auth.js';

/**
 * A customer's saved videos. Ownership lives only here — the `videos` table stays
 * a shared catalog keyed by YouTube video id and is written by the CLI too.
 */

/** Idempotent: re-adding an already-saved video is a no-op, guarded by the composite unique index. */
export async function saveLibraryVideo(input: LibraryVideoInput): Promise<void> {
  const done = log.dbCalled('saveLibraryVideo', undefined, {
    customerId: input.customerId,
    videoId: input.videoId,
  });
  const ts = new Date();
  await getDb()
    .insert(libraryVideos)
    .values({
      id: `lib-${nanoid()}`,
      customerId: input.customerId,
      videoId: input.videoId,
      savedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    })
    .onConflictDoNothing()
    .returning({ id: libraryVideos.id });
  done({ videoId: input.videoId });
}

export async function removeLibraryVideo(customerId: string, videoId: string): Promise<void> {
  const done = log.dbCalled('removeLibraryVideo', undefined, { customerId, videoId });
  await getDb()
    .delete(libraryVideos)
    .where(and(eq(libraryVideos.customerId, customerId), eq(libraryVideos.videoId, videoId)))
    .returning({ id: libraryVideos.id });
  done({ deleted: 1 });
}

/** Which of `videoIds` this customer has already saved. Marks Add vs Added on the browse grid. */
export async function findSavedVideoIds(customerId: string, videoIds: string[]): Promise<string[]> {
  const done = log.dbCalled('findSavedVideoIds', undefined, {
    customerId,
    count: videoIds.length,
  });
  if (videoIds.length === 0) {
    done({ found: 0 });
    return [];
  }
  const rows = await getDb()
    .select({ videoId: libraryVideos.videoId })
    .from(libraryVideos)
    .where(and(eq(libraryVideos.customerId, customerId), inArray(libraryVideos.videoId, videoIds)));
  done({ found: rows.length });
  return rows.map((r) => r.videoId);
}

/** One page of the library, newest save first, joined to the catalog row. */
export async function listLibraryVideos(
  customerId: string,
  limit: number,
  offset: number,
): Promise<LibraryVideoPage> {
  const done = log.dbCalled('listLibraryVideos', undefined, { customerId, limit, offset });
  const [rows, [totalRow]] = await Promise.all([
    getDb()
      .select({ saved: libraryVideos, video: videos })
      .from(libraryVideos)
      .innerJoin(videos, eq(libraryVideos.videoId, videos.id))
      .where(eq(libraryVideos.customerId, customerId))
      .orderBy(desc(libraryVideos.savedAt))
      .limit(limit)
      .offset(offset),
    getDb()
      .select({ value: count() })
      .from(libraryVideos)
      .where(eq(libraryVideos.customerId, customerId)),
  ]);
  const entries: LibraryVideoEntry[] = rows.map(({ saved, video }) => ({
    videoId: video.id,
    title: video.title,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    publishedAt: video.publishedAt?.toISOString() ?? '',
    durationSec: video.durationSec,
    ...(video.thumbnailUrl ? { thumbnailUrl: video.thumbnailUrl } : {}),
    savedAt: saved.savedAt.toISOString(),
  }));
  done({ count: entries.length });
  return { videos: entries, total: totalRow?.value ?? 0, limit, offset };
}
