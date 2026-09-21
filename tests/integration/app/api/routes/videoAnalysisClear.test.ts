import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@app/api/app.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../support/postgres.js';
import { seedVideo } from '../../../lib/services/db/postgresFixtures.js';

const app = createApp();
const VIDEO_ID = 'analysis-clear-video';
let database: PostgresTestDatabase;

async function seedDerivedRows(): Promise<void> {
  await seedVideo(database, VIDEO_ID);
  await database.query(
    `insert into chunks
       (id, video_id, chunk, analysis, score, start, "end", rank, created_at, updated_at)
     values
       ('chunk-clear', $1, '{"start":0,"end":30,"text":"hello"}'::jsonb,
        '{"status":"success","chunk_index":0,"chunk_start":0,"chunk_end":30,"interesting":true,"score":8,"reason":"test","clip_start":1,"clip_end":5}'::jsonb,
        8, 0, 30, 1, now(), now())`,
    [VIDEO_ID],
  );
  await database.query(
    `insert into segmentations
       (id, video_id, rank, start_sec, end_sec, score, reason, source, options_hash,
        completed, created_at, updated_at)
     values ('segment-clear', $1, 1, 1, 5, 8, 'test', 'transcript', 'options', true,
             now(), now())`,
    [VIDEO_ID],
  );
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('video_analysis_clear');
});

beforeEach(async () => {
  await database.reset();
  await seedDerivedRows();
});

afterAll(async () => {
  await database.close();
});

describe('DELETE /api/videos/:videoId/analysis', () => {
  it('clears chunk evaluations and segmentations together', async () => {
    const response = await app.request(`/api/videos/${VIDEO_ID}/analysis`, { method: 'DELETE' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      chunksCleared: 1,
      segmentationsCleared: 1,
    });
    const chunks = await database.query<{
      analysis: unknown;
      score: number | null;
      rank: number | null;
    }>('select analysis, score, rank from chunks where video_id = $1', [VIDEO_ID]);
    expect(chunks.rows).toEqual([{ analysis: null, score: null, rank: null }]);
    const segmentations = await database.query<{ count: number }>(
      'select count(*)::int as count from segmentations where video_id = $1',
      [VIDEO_ID],
    );
    expect(segmentations.rows[0]?.count).toBe(0);
  });

  it('rolls back chunk clearing when segmentation deletion fails', async () => {
    await database.query(
      `create function reject_segmentation_delete() returns trigger language plpgsql as $body$
       begin
         raise exception 'forced segmentation delete failure';
       end;
       $body$`,
    );
    await database.query(
      `create trigger reject_segmentation_delete
       before delete on segmentations
       for each statement execute function reject_segmentation_delete()`,
    );

    try {
      const response = await app.request(`/api/videos/${VIDEO_ID}/analysis`, { method: 'DELETE' });
      expect(response.status).toBe(500);

      const chunks = await database.query<{ analysis: unknown; score: number; rank: number }>(
        'select analysis, score, rank from chunks where video_id = $1',
        [VIDEO_ID],
      );
      expect(chunks.rows[0]).toMatchObject({ score: 8, rank: 1 });
      expect(chunks.rows[0]?.analysis).not.toBeNull();
      const segmentations = await database.query<{ count: number }>(
        'select count(*)::int as count from segmentations where video_id = $1',
        [VIDEO_ID],
      );
      expect(segmentations.rows[0]?.count).toBe(1);
    } finally {
      await database.query('drop trigger reject_segmentation_delete on segmentations');
      await database.query('drop function reject_segmentation_delete()');
    }
  });
});
