import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clearSegmentations,
  findSegmentations,
  insertSegmentation,
  markSegmentationsComplete,
  upsertSegmentations,
} from '@lib/services/db/index.js';
import type { RankedSegment } from '@lib/types/index.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../../support/postgres.js';
import { seedVideo } from '../postgresFixtures.js';

const VIDEO_ID = 'vid_test_001';
const OTHER_VIDEO_ID = 'other_video';
const HASH_A = JSON.stringify({ maxChunks: null, refine: true, threshold: 7, topN: 10 });
const HASH_B = JSON.stringify({ maxChunks: null, refine: false, threshold: 6, topN: 5 });
let database: PostgresTestDatabase;

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
  return base.map((segment, index) => ({ ...segment, ...(overrides[index] ?? {}) }));
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('segmentations_repo');
});

beforeEach(async () => {
  await database.reset();
  await Promise.all([seedVideo(database, VIDEO_ID), seedVideo(database, OTHER_VIDEO_ID)]);
});

afterAll(async () => {
  await database.close();
});

describe('segmentationsRepo', () => {
  describe('findSegmentations', () => {
    it('returns [] when no rows exist for the video', async () => {
      expect(await findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
    });

    it('returns [] when rows exist but options hash differs', async () => {
      await upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      expect(await findSegmentations(VIDEO_ID, HASH_B)).toEqual([]);
    });

    it('returns cached segments when hash matches', async () => {
      await upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      const result = await findSegmentations(VIDEO_ID, HASH_A);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        rank: 1,
        start: 10,
        end: 40,
        score: 9,
        reason: 'Very funny',
        source: 'transcript',
      });
      expect(result[0]?.audio_event).toBeUndefined();
      expect(result[1]?.audio_event).toBe('applause');
    });

    it('orders cached segments by rank regardless of insertion order', async () => {
      const [first, second] = makeSegments();
      await upsertSegmentations(VIDEO_ID, [second!, first!], HASH_A);

      expect((await findSegmentations(VIDEO_ID, HASH_A)).map((segment) => segment.rank)).toEqual([
        1, 2,
      ]);
    });

    it('does not return rows from a different video', async () => {
      await upsertSegmentations(OTHER_VIDEO_ID, makeSegments(), HASH_A);
      expect(await findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
    });
  });

  describe('upsertSegmentations', () => {
    it('is idempotent and replaces the prior batch atomically', async () => {
      await upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      await upsertSegmentations(VIDEO_ID, makeSegments([{ score: 8 }]), HASH_B);

      expect(await findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
      const replacement = await findSegmentations(VIDEO_ID, HASH_B);
      expect(replacement).toHaveLength(2);
      expect(replacement[0]?.score).toBe(8);
    });

    it('handles an empty segments array', async () => {
      await upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      await upsertSegmentations(VIDEO_ID, [], HASH_A);
      expect(await findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
    });
  });

  describe('insertSegmentation + markSegmentationsComplete', () => {
    it('keeps an incremental batch hidden until its boolean completion flag is set', async () => {
      for (const segment of makeSegments()) {
        await insertSegmentation(VIDEO_ID, segment, HASH_A);
      }
      expect(await findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
      const before = await database.query<{ completed: boolean }>(
        'select completed from segmentations where video_id = $1 order by rank',
        [VIDEO_ID],
      );
      expect(before.rows).toEqual([{ completed: false }, { completed: false }]);

      await markSegmentationsComplete(VIDEO_ID);

      const result = await findSegmentations(VIDEO_ID, HASH_A);
      expect(result).toHaveLength(2);
      expect(result[0]?.rank).toBe(1);
      expect(result[1]?.audio_event).toBe('applause');
    });

    it('markSegmentationsComplete is idempotent', async () => {
      await insertSegmentation(VIDEO_ID, makeSegments()[0]!, HASH_A);
      await markSegmentationsComplete(VIDEO_ID);
      await markSegmentationsComplete(VIDEO_ID);
      expect(await findSegmentations(VIDEO_ID, HASH_A)).toHaveLength(1);
    });

    it('clearSegmentations removes stale rows from an aborted run', async () => {
      for (const segment of makeSegments()) {
        await insertSegmentation(VIDEO_ID, segment, HASH_A);
      }
      await clearSegmentations(VIDEO_ID);
      await markSegmentationsComplete(VIDEO_ID);
      expect(await findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
    });
  });

  describe('clearSegmentations', () => {
    it('deletes all rows for the video and returns count', async () => {
      await upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      expect(await clearSegmentations(VIDEO_ID)).toBe(2);
      expect(await findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
    });

    it('returns 0 when no rows exist', async () => {
      expect(await clearSegmentations('nonexistent_video')).toBe(0);
    });

    it('only deletes rows for the specified video', async () => {
      await upsertSegmentations(VIDEO_ID, makeSegments(), HASH_A);
      await upsertSegmentations(OTHER_VIDEO_ID, makeSegments(), HASH_A);
      await clearSegmentations(VIDEO_ID);
      expect(await findSegmentations(VIDEO_ID, HASH_A)).toEqual([]);
      expect(await findSegmentations(OTHER_VIDEO_ID, HASH_A)).toHaveLength(2);
    });
  });
});
