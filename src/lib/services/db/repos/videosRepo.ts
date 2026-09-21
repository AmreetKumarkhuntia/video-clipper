import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../client.js';
import { videos } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { VideoDetails } from '@lib/types/youtube.js';
import type { TranscriptLine } from '@lib/types/transcript.js';
import { TranscriptLineSchema } from '@lib/types/transcript.js';
import type { VideoRecord } from '@lib/types/db.js';

const TagsSchema = z.array(z.string());

function publishedAtDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function rowToRecord(row: typeof videos.$inferSelect): VideoRecord {
  return {
    ...row,
    publishedAt: row.publishedAt?.toISOString() ?? '',
    tags: JSON.stringify(TagsSchema.parse(row.tags)),
    transcriptLines:
      row.transcriptLines === null
        ? null
        : JSON.stringify(TranscriptLineSchema.array().parse(row.transcriptLines)),
    transcriptFetchedAt: row.transcriptFetchedAt?.toISOString() ?? null,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function upsertVideo(
  video: Pick<
    VideoDetails,
    | 'id'
    | 'channelId'
    | 'title'
    | 'description'
    | 'channelTitle'
    | 'publishedAt'
    | 'durationSec'
    | 'tags'
    | 'thumbnail'
  >,
): Promise<void> {
  const done = log.dbCalled('upsertVideo', undefined, { id: video.id, channelId: video.channelId });
  const ts = new Date();
  await getDb()
    .insert(videos)
    .values({
      id: video.id,
      channelId: video.channelId,
      title: video.title,
      description: video.description,
      channelTitle: video.channelTitle,
      publishedAt: publishedAtDate(video.publishedAt),
      durationSec: video.durationSec,
      tags: TagsSchema.parse(video.tags),
      thumbnailUrl: video.thumbnail?.url ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: videos.id,
      set: {
        title: video.title,
        description: video.description,
        channelTitle: video.channelTitle,
        publishedAt: publishedAtDate(video.publishedAt),
        durationSec: video.durationSec,
        tags: TagsSchema.parse(video.tags),
        thumbnailUrl: video.thumbnail?.url ?? null,
        updatedAt: ts,
      },
    })
    .returning({ id: videos.id });
  done({ id: video.id });
}

export async function findVideo(videoId: string): Promise<VideoRecord | null> {
  const done = log.dbCalled('findVideo', undefined, { videoId });
  const [row] = await getDb().select().from(videos).where(eq(videos.id, videoId)).limit(1);
  done({ found: row !== undefined });
  return row ? rowToRecord(row) : null;
}

export async function saveTranscript(
  videoId: string,
  lines: TranscriptLine[],
  fetchedAt: string,
): Promise<void> {
  const done = log.dbCalled('saveTranscript', undefined, {
    videoId,
    lineCount: lines.length,
    fetchedAt,
  });
  await getDb()
    .update(videos)
    .set({
      transcriptLines: TranscriptLineSchema.array().parse(lines),
      transcriptFetchedAt: new Date(fetchedAt),
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId))
    .returning({ id: videos.id });
  done({});
}

export async function findTranscriptLines(
  videoId: string,
): Promise<{ lines: TranscriptLine[]; fetchedAt: string } | null> {
  const done = log.dbCalled('findTranscriptLines', undefined, { videoId });
  const [row] = await getDb().select().from(videos).where(eq(videos.id, videoId)).limit(1);
  if (!row?.transcriptLines || !row.transcriptFetchedAt) {
    done({ found: false });
    return null;
  }
  const lines = TranscriptLineSchema.array().parse(row.transcriptLines);
  done({ found: true, lineCount: lines.length });
  return { lines, fetchedAt: row.transcriptFetchedAt.toISOString() };
}

export async function clearTranscript(videoId: string): Promise<boolean> {
  const done = log.dbCalled('clearTranscript', undefined, { videoId });
  const rows = await getDb()
    .update(videos)
    .set({ transcriptLines: null, transcriptFetchedAt: null, updatedAt: new Date() })
    .where(eq(videos.id, videoId))
    .returning({ id: videos.id });
  if (rows.length === 0) {
    done({ cleared: false, reason: 'video not found' });
    return false;
  }
  done({ cleared: true });
  return true;
}

/** Batch catalog lookup, used to hydrate a page of saved video ids in one query. */
export async function findVideosByIds(videoIds: string[]): Promise<VideoRecord[]> {
  const done = log.dbCalled('findVideosByIds', undefined, { count: videoIds.length });
  if (videoIds.length === 0) {
    done({ found: 0 });
    return [];
  }
  const rows = await getDb().select().from(videos).where(inArray(videos.id, videoIds));
  done({ found: rows.length });
  return rows.map(rowToRecord);
}
