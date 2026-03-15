import type { AnalyzedSegment, RankedSegment } from '../../types/index.js';

/**
 * Returns the overlap duration in seconds between two segments [aStart, aEnd) and [bStart, bEnd).
 * Returns 0 if they do not overlap.
 */
function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

/**
 * Returns true if two segments overlap by more than 50% of either segment's duration.
 */
function significantlyOverlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  const overlap = overlapSeconds(aStart, aEnd, bStart, bEnd);
  if (overlap === 0) return false;
  const aDuration = aEnd - aStart;
  const bDuration = bEnd - bStart;
  return overlap / aDuration > 0.5 || overlap / bDuration > 0.5;
}

/**
 * Deduplicates segments: for any two segments that overlap by more than 50% of
 * either segment's duration, keep the one with the higher score.
 *
 * Assumes input is already sorted by score DESC.
 */
function deduplicateSegments(
  segments: Array<{ start: number; end: number; score: number; reason: string }>,
): Array<{ start: number; end: number; score: number; reason: string }> {
  const kept: typeof segments = [];

  for (const candidate of segments) {
    const dominated = kept.some((existing) =>
      significantlyOverlaps(existing.start, existing.end, candidate.start, candidate.end),
    );
    if (!dominated) {
      kept.push(candidate);
    }
  }

  return kept;
}

/**
 * Filters, deduplicates, sorts, and ranks analyzed segments.
 *
 * Steps:
 * 1. Keep only segments where `interesting === true` and `score >= threshold`
 * 2. Sort by `score` DESC
 * 3. Deduplicate overlapping segments (>50% overlap → keep higher score)
 * 4. Cap at `topN`
 * 5. Assign sequential `rank` (1-indexed)
 * 6. Rename `clip_start`/`clip_end` → `start`/`end`
 */
export function rankSegments(
  segments: AnalyzedSegment[],
  threshold: number,
  topN: number,
): RankedSegment[] {
  const filtered = segments
    .filter((s) => s.interesting && s.score >= threshold)
    .sort((a, b) => b.score - a.score);

  const normalized = filtered.map((s) => ({
    start: s.clip_start,
    end: s.clip_end,
    score: s.score,
    reason: s.reason,
  }));

  const deduped = deduplicateSegments(normalized);

  return deduped.slice(0, topN).map((s, i) => ({
    rank: i + 1,
    start: s.start,
    end: s.end,
    score: s.score,
    reason: s.reason,
  }));
}
