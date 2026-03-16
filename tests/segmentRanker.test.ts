import { describe, it, expect, beforeEach } from 'vitest';
import { rankSegments } from '../src/services/segmentRanker/index.js';
import type { MergedCandidate } from '../src/types/index.js';

function seg(
  start: number,
  end: number,
  score: number,
  source: 'transcript' | 'audio' | 'both' = 'transcript',
  audio_event?: string,
): MergedCandidate {
  return {
    start,
    end,
    score,
    source,
    reason: `reason for ${start}-${end}`,
    audio_event,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rankSegments', () => {
  it('returns empty array when input is empty', () => {
    expect(rankSegments([], 7, 10)).toEqual([]);
  });

  it('filters out segments with score below threshold', () => {
    const segments = [seg(0, 30, 6), seg(30, 60, 8)];
    const result = rankSegments(segments, 7, 10);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(8);
  });

  it('filters out segments with score below threshold', () => {
    const segments = [seg(0, 30, 6, 'transcript'), seg(30, 60, 8, 'transcript')];
    const result = rankSegments(segments, 7, 10);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(8);
  });

  it('filters out segments exactly at threshold (must be >=)', () => {
    const segments = [seg(0, 30, 7), seg(30, 60, 6)];
    const result = rankSegments(segments, 7, 10);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(7);
  });

  it('sorts segments by score descending', () => {
    const segments = [seg(0, 30, 7), seg(60, 90, 9), seg(120, 150, 8)];
    const result = rankSegments(segments, 7, 10);
    expect(result.map((r) => r.score)).toEqual([9, 8, 7]);
  });

  it('assigns sequential ranks starting at 1', () => {
    const segments = [seg(0, 30, 9), seg(60, 90, 8), seg(120, 150, 7)];
    const result = rankSegments(segments, 7, 10);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('caps output at topN', () => {
    const segments = Array.from({ length: 8 }, (_, i) => seg(i * 60, i * 60 + 30, 10 - i));
    const result = rankSegments(segments, 1, 3);
    expect(result).toHaveLength(3);
    expect(result[0].rank).toBe(1);
    expect(result[2].rank).toBe(3);
  });

  it('renames clip_start/clip_end to start/end', () => {
    const segments = [seg(42, 99, 8)];
    const result = rankSegments(segments, 7, 10);
    expect(result[0].start).toBe(42);
    expect(result[0].end).toBe(99);
    // RankedSegment type should not have clip_start / clip_end
    expect((result[0] as Record<string, unknown>)['clip_start']).toBeUndefined();
    expect((result[0] as Record<string, unknown>)['clip_end']).toBeUndefined();
  });

  describe('deduplication', () => {
    it('drops the lower-scored segment when overlap > 50% of either duration', () => {
      // Segment A: 0–100 (100s), Segment B: 60–120 (60s)
      // Overlap: 60–100 = 40s
      // 40/100 = 40% of A, 40/60 = 66% of B → significant overlap → drop B (lower score)
      const segments = [seg(0, 100, 9), seg(60, 120, 8)];
      const result = rankSegments(segments, 7, 10);
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(9);
      expect(result[0].start).toBe(0);
    });

    it('keeps both segments when overlap is <= 50% of both durations', () => {
      // Segment A: 0–100 (100s), Segment B: 80–200 (120s)
      // Overlap: 80–100 = 20s
      // 20/100 = 20% of A, 20/120 = 16% of B → not significant → keep both
      const segments = [seg(0, 100, 9), seg(80, 200, 8)];
      const result = rankSegments(segments, 7, 10);
      expect(result).toHaveLength(2);
    });

    it('keeps both non-overlapping segments', () => {
      const segments = [seg(0, 30, 9), seg(60, 90, 8)];
      const result = rankSegments(segments, 7, 10);
      expect(result).toHaveLength(2);
    });

    it('keeps the higher-scored segment when two nearly identical segments compete', () => {
      const segments = [seg(0, 60, 7), seg(10, 70, 9)];
      // Overlap: 10–60 = 50s; A duration=60, B duration=60
      // 50/60 ≈ 83% → significant → keep score=9
      const result = rankSegments(segments, 7, 10);
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(9);
    });

    it('correctly deduplicates multiple overlapping segments keeping highest scores', () => {
      // Three segments all overlapping with the first
      const segments = [
        seg(0, 60, 9), // best, kept
        seg(10, 70, 8), // overlaps A > 50% → dropped
        seg(20, 80, 7), // overlaps A > 50% → dropped
        seg(200, 250, 8), // no overlap → kept
      ];
      const result = rankSegments(segments, 7, 10);
      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(9);
      expect(result[1].score).toBe(8);
      expect(result[1].start).toBe(200);
    });
  });
});
