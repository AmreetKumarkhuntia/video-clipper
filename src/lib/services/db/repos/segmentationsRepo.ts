import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../client.js';
import { segmentations } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { RankedSegment } from '@lib/types/index.js';
import type { SegmentationInsert } from '@lib/types/db.js';

/**
 * Returns completed cached RankedSegment[] for the given videoId + options fingerprint.
 * Returns [] (cache miss) when no rows exist, the options hash doesn't match,
 * or the batch was never marked complete (aborted/interrupted run).
 */
export function findSegmentations(videoId: string, optionsHash: string): RankedSegment[] {
  const done = log.dbCalled('findSegmentations', undefined, { videoId });
  const rows = db
    .select()
    .from(segmentations)
    .where(
      and(
        eq(segmentations.videoId, videoId),
        eq(segmentations.optionsHash, optionsHash),
        eq(segmentations.completed, 1),
      ),
    )
    .all();
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
 * Inserts a single segmentation row with completed=0.
 * Used during incremental (per-segment) writes in the refine path.
 * Call markSegmentationsComplete() after all segments are written.
 */
export function insertSegmentation(
  videoId: string,
  segment: RankedSegment,
  optionsHash: string,
): void {
  const ts = Date.now();
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
  db.insert(segmentations)
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
      completed: 0,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
}

/**
 * Marks all segmentation rows for the given videoId as complete (completed=1).
 * Called after the last insertSegmentation() in a refine batch so the batch
 * becomes visible to findSegmentations().
 */
export function markSegmentationsComplete(videoId: string): void {
  const done = log.dbCalled('markSegmentationsComplete', undefined, { videoId });
  db.update(segmentations)
    .set({ completed: 1, updatedAt: Date.now() })
    .where(eq(segmentations.videoId, videoId))
    .run();
  done({});
}

/**
 * Replaces all segmentation rows for the given videoId with a complete batch (completed=1).
 * Used for the no-refine path where all segments are available synchronously.
 */
export function upsertSegmentations(
  videoId: string,
  segments: RankedSegment[],
  optionsHash: string,
): void {
  const done = log.dbCalled('upsertSegmentations', undefined, {
    videoId,
    count: segments.length,
  });
  db.delete(segmentations).where(eq(segmentations.videoId, videoId)).run();
  const ts = Date.now();
  for (const seg of segments) {
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
    db.insert(segmentations)
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
        completed: 1,
        createdAt: ts,
        updatedAt: ts,
      })
      .run();
  }
  done({});
}

/**
 * Deletes all segmentation rows for the given videoId.
 * Called when chunk analysis is re-run (rankings may change) or at the start
 * of a new refine pass to clear stale partial rows from a prior aborted run.
 * Returns the number of rows deleted.
 */
export function clearSegmentations(videoId: string): number {
  const done = log.dbCalled('clearSegmentations', undefined, { videoId });
  const result = db.delete(segmentations).where(eq(segmentations.videoId, videoId)).run();
  done({});
  return result.changes ?? 0;
}
