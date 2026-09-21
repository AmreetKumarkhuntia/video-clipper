import { eq, and, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb, withDbTransaction } from '../client.js';
import { segmentations } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { RankedSegment } from '@lib/types/index.js';
import type { SegmentationInsert } from '@lib/types/db.js';

/**
 * Returns completed cached RankedSegment[] for the given videoId + options fingerprint.
 * Returns [] (cache miss) when no rows exist, the options hash doesn't match,
 * or the batch was never marked complete (aborted/interrupted run).
 */
export async function findSegmentations(
  videoId: string,
  optionsHash: string,
): Promise<RankedSegment[]> {
  const done = log.dbCalled('findSegmentations', undefined, { videoId });
  const rows = await getDb()
    .select()
    .from(segmentations)
    .where(
      and(
        eq(segmentations.videoId, videoId),
        eq(segmentations.optionsHash, optionsHash),
        eq(segmentations.completed, true),
      ),
    )
    .orderBy(asc(segmentations.rank));
  done({ count: rows.length });
  return rows.map((r) => ({
    rank: r.rank,
    start: r.startSec,
    end: r.endSec,
    score: r.score,
    reason: r.reason,
    source: r.source as RankedSegment['source'],
    audio_event: r.audioEvent ?? undefined,
  }));
}

/**
 * Inserts a single segmentation row with completed=false.
 * Used during incremental (per-segment) writes in the refine path.
 * Call markSegmentationsComplete() after all segments are written.
 */
export async function insertSegmentation(
  videoId: string,
  segment: RankedSegment,
  optionsHash: string,
): Promise<void> {
  const ts = new Date();
  const row: SegmentationInsert = {
    videoId,
    rank: segment.rank,
    startSec: segment.start,
    endSec: segment.end,
    score: segment.score,
    reason: segment.reason,
    source: segment.source,
    audioEvent: segment.audio_event,
    optionsHash,
  };
  await getDb()
    .insert(segmentations)
    .values({
      id: nanoid(),
      videoId: row.videoId,
      rank: row.rank,
      startSec: row.startSec,
      endSec: row.endSec,
      score: row.score,
      reason: row.reason,
      source: row.source,
      audioEvent: row.audioEvent ?? null,
      optionsHash: row.optionsHash,
      completed: false,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning({ id: segmentations.id });
}

/**
 * Marks all segmentation rows for the given videoId as complete.
 * Called after the last insertSegmentation() in a refine batch so the batch
 * becomes visible to findSegmentations().
 */
export async function markSegmentationsComplete(videoId: string): Promise<void> {
  const done = log.dbCalled('markSegmentationsComplete', undefined, { videoId });
  await getDb()
    .update(segmentations)
    .set({ completed: true, updatedAt: new Date() })
    .where(eq(segmentations.videoId, videoId))
    .returning({ id: segmentations.id });
  done({});
}

/**
 * Replaces all segmentation rows for the given videoId with a complete batch.
 * Used for the no-refine path where all segments are available synchronously.
 */
export async function upsertSegmentations(
  videoId: string,
  segments: RankedSegment[],
  optionsHash: string,
): Promise<void> {
  const done = log.dbCalled('upsertSegmentations', undefined, {
    videoId,
    count: segments.length,
  });
  const ts = new Date();
  await withDbTransaction(async () => {
    const db = getDb();
    await db.delete(segmentations).where(eq(segmentations.videoId, videoId));
    if (segments.length === 0) return;
    await db.insert(segmentations).values(
      segments.map((seg) => {
        const row: SegmentationInsert = {
          videoId,
          rank: seg.rank,
          startSec: seg.start,
          endSec: seg.end,
          score: seg.score,
          reason: seg.reason,
          source: seg.source,
          audioEvent: seg.audio_event,
          optionsHash,
        };
        return {
          id: nanoid(),
          videoId: row.videoId,
          rank: row.rank,
          startSec: row.startSec,
          endSec: row.endSec,
          score: row.score,
          reason: row.reason,
          source: row.source,
          audioEvent: row.audioEvent ?? null,
          optionsHash: row.optionsHash,
          completed: true,
          createdAt: ts,
          updatedAt: ts,
        };
      }),
    );
  });
  done({});
}

/**
 * Deletes all segmentation rows for the given videoId.
 * Called when chunk analysis is re-run (rankings may change) or at the start
 * of a new refine pass to clear stale partial rows from a prior aborted run.
 * Returns the number of rows deleted.
 */
export async function clearSegmentations(videoId: string): Promise<number> {
  const done = log.dbCalled('clearSegmentations', undefined, { videoId });
  const rows = await getDb()
    .delete(segmentations)
    .where(eq(segmentations.videoId, videoId))
    .returning({ id: segmentations.id });
  done({});
  return rows.length;
}
