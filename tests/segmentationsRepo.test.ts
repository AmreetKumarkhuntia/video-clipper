import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from '../src/lib/services/db/schema.js';
import type { RankedSegment } from '../src/lib/types/index.js';

// ── In-memory DB setup ────────────────────────────────────────────────────────

const sqlite = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

vi.mock('../src/lib/services/db/client.js', () => ({ db: testDb }));

// ── Import repo after mock is in place ───────────────────────────────────────

const {
  findSegmentations,
  upsertSegmentations,
  clearSegmentations,
  insertSegmentation,
  markSegmentationsComplete,
} = await import('../src/lib/services/db/repos/segmentationsRepo.js');

// ── Test data ─────────────────────────────────────────────────────────────────

const VIDEO_ID = 'vid_test_001';
const HASH_A = JSON.stringify({ maxChunks: null, refine: true, threshold: 7, topN: 10 });
const HASH_B = JSON.stringify({ maxChunks: null, refine: false, threshold: 6, topN: 5 });

function makeSegments(overrides: Partial<RankedSegment>[] = []): RankedSegment[] {
  const base: RankedSegment[] = [
    { rank: 1, start: 10, end: 40, score: 9, reason: 'Very funny', source: 'transcript' },
    {
      rank: 2,
      start: 120,
      end: 160,
      score: 7.5,
      reason: 'Surprising insight',
      source: 'transcript',
      audio_event: 'applause',
    },
  ];
  return base.map((s, i) => ({ ...s, ...(overrides[i] ?? {}) }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('segmentationsRepo', () => {
  beforeEach(() => {
    clearSegmentations(VIDEO_ID);
    clearSegmentations('other_video');
  });

  // ── findSegmentations ──────────────────────────────────────────────────────

  describe('findSegmentations', () => {
    it('returns [] when no rows exist for the video', () => {
      expect(findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
    });

    it('returns [] when rows exist but options hash differs', () => {
      upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      expect(findSegmentations(VIDEO_ID, HASH_B)).toEqual([]);
    });

    it('returns cached segments when hash matches', () => {
      const segments = makeSegments();
      upsertSegmentations(VIDEO_ID, segments, HASH_A);
      const result = findSegmentations(VIDEO_ID, HASH_A);
      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[0].start).toBe(10);
      expect(result[0].end).toBe(40);
      expect(result[0].score).toBe(9);
      expect(result[0].reason).toBe('Very funny');
      expect(result[0].source).toBe('transcript');
      expect(result[0].audio_event).toBeUndefined();
    });

    it('preserves optional audio_event field', () => {
      upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      const result = findSegmentations(VIDEO_ID, HASH_A);
      expect(result[1].audio_event).toBe('applause');
    });

    it('does not return rows from a different video', () => {
      upsertSegmentations('other_video', makeSegments(), HASH_A);
      expect(findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
    });

    it('returns [] for completed=0 rows (aborted refine run)', () => {
      // Simulate an aborted refine: rows inserted but never marked complete
      for (const seg of makeSegments()) {
        insertSegmentation(VIDEO_ID, seg, HASH_A);
      }
      // completed=0 — must not be served as a cache hit
      expect(findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
    });

    it('returns rows only after markSegmentationsComplete', () => {
      for (const seg of makeSegments()) {
        insertSegmentation(VIDEO_ID, seg, HASH_A);
      }
      expect(findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);

      markSegmentationsComplete(VIDEO_ID);
      expect(findSegmentations(VIDEO_ID, HASH_A)).toHaveLength(2);
    });
  });

  // ── upsertSegmentations ────────────────────────────────────────────────────

  describe('upsertSegmentations', () => {
    it('inserts rows that can be read back immediately (completed=1)', () => {
      upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      expect(findSegmentations(VIDEO_ID, HASH_A)).toHaveLength(2);
    });

    it('is idempotent — re-inserting the same data overwrites cleanly', () => {
      upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      expect(findSegmentations(VIDEO_ID, HASH_A)).toHaveLength(2);
    });

    it('replaces all rows (including different hash) when called again', () => {
      upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      const updated = makeSegments([{ score: 8 }]);
      upsertSegmentations(VIDEO_ID, updated, HASH_B);
      expect(findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
      const result = findSegmentations(VIDEO_ID, HASH_B);
      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(8);
    });

    it('handles an empty segments array', () => {
      upsertSegmentations(VIDEO_ID, [], HASH_A);
      expect(findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
    });
  });

  // ── insertSegmentation + markSegmentationsComplete ────────────────────────

  describe('insertSegmentation + markSegmentationsComplete', () => {
    it('full incremental round-trip matches upsertSegmentations output', () => {
      const segments = makeSegments();
      for (const seg of segments) {
        insertSegmentation(VIDEO_ID, seg, HASH_A);
      }
      markSegmentationsComplete(VIDEO_ID);

      const result = findSegmentations(VIDEO_ID, HASH_A);
      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[1].audio_event).toBe('applause');
    });

    it('rows are invisible until markSegmentationsComplete is called', () => {
      const [seg] = makeSegments();
      insertSegmentation(VIDEO_ID, seg, HASH_A);
      expect(findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
      markSegmentationsComplete(VIDEO_ID);
      expect(findSegmentations(VIDEO_ID, HASH_A)).toHaveLength(1);
    });

    it('markSegmentationsComplete is idempotent', () => {
      insertSegmentation(VIDEO_ID, makeSegments()[0], HASH_A);
      markSegmentationsComplete(VIDEO_ID);
      markSegmentationsComplete(VIDEO_ID);
      expect(findSegmentations(VIDEO_ID, HASH_A)).toHaveLength(1);
    });

    it('clearSegmentations removes completed=0 rows (stale aborted run cleanup)', () => {
      for (const seg of makeSegments()) {
        insertSegmentation(VIDEO_ID, seg, HASH_A);
      }
      // Abort — never mark complete
      clearSegmentations(VIDEO_ID);
      markSegmentationsComplete(VIDEO_ID); // no-op, nothing to flip
      expect(findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
    });
  });

  // ── clearSegmentations ────────────────────────────────────────────────────

  describe('clearSegmentations', () => {
    it('deletes all rows for the video and returns count', () => {
      upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      const deleted = clearSegmentations(VIDEO_ID);
      expect(deleted).toBe(2);
      expect(findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
    });

    it('returns 0 when no rows exist', () => {
      expect(clearSegmentations('nonexistent_video')).toBe(0);
    });

    it('only deletes rows for the specified video', () => {
      upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      upsertSegmentations('other_video', makeSegments(), HASH_A);
      clearSegmentations(VIDEO_ID);
      expect(findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
      expect(findSegmentations('other_video', HASH_A)).toHaveLength(2);
    });
  });
});
