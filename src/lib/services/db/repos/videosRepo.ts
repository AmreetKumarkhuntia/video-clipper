import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../client.js';
import { videos } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { VideoDetails } from '@lib/types/youtube.js';
import type { TranscriptLine } from '@lib/types/transcript.js';
import { TranscriptLineSchema } from '@lib/types/transcript.js';

export function upsertVideo(
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
  >,
): void {
  const done = log.dbCalled('upsertVideo', undefined, { id: video.id, channelId: video.channelId });
  const ts = Date.now();
  db.insert(videos)
    .values({
      id: video.id,
      channelId: video.channelId,
      title: video.title,
      description: video.description,
      channelTitle: video.channelTitle,
      publishedAt: video.publishedAt,
      durationSec: video.durationSec,
      tags: JSON.stringify(video.tags),
      createdAt: ts,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: videos.id,
      set: {
        title: video.title,
        description: video.description,
        channelTitle: video.channelTitle,
        publishedAt: video.publishedAt,
        durationSec: video.durationSec,
        tags: JSON.stringify(video.tags),
        updatedAt: ts,
      },
    })
    .run();
  done({ id: video.id });
}

export function findVideo(videoId: string): typeof videos.$inferSelect | null {
  const done = log.dbCalled('findVideo', undefined, { videoId });
  const row = db.select().from(videos).where(eq(videos.id, videoId)).get() ?? null;
  done({ found: row !== null });
  return row;
}

export function saveTranscript(videoId: string, lines: TranscriptLine[], fetchedAt: string): void {
  const done = log.dbCalled('saveTranscript', undefined, {
    videoId,
    lineCount: lines.length,
    fetchedAt,
  });
  db.update(videos)
    .set({
      transcriptLines: JSON.stringify(lines),
      transcriptFetchedAt: fetchedAt,
      updatedAt: Date.now(),
    })
    .where(eq(videos.id, videoId))
    .run();
  done({});
}

export function findTranscriptLines(
  videoId: string,
): { lines: TranscriptLine[]; fetchedAt: string } | null {
  const done = log.dbCalled('findTranscriptLines', undefined, { videoId });
  const row = db.select().from(videos).where(eq(videos.id, videoId)).get();
  if (!row?.transcriptLines) {
    done({ found: false });
    return null;
  }
  const lines = z.array(TranscriptLineSchema).parse(JSON.parse(row.transcriptLines));
  done({ found: true, lineCount: lines.length });
  return { lines, fetchedAt: row.transcriptFetchedAt! };
}

export function clearTranscript(videoId: string): boolean {
  const done = log.dbCalled('clearTranscript', undefined, { videoId });
  const row = db.select({ id: videos.id }).from(videos).where(eq(videos.id, videoId)).get();
  if (!row) {
    done({ cleared: false, reason: 'video not found' });
    return false;
  }
  db.update(videos)
    .set({ transcriptLines: null, transcriptFetchedAt: null, updatedAt: Date.now() })
    .where(eq(videos.id, videoId))
    .run();
  done({ cleared: true });
  return true;
}
