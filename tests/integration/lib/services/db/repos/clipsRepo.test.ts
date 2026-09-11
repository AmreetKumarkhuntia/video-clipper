import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@lib/services/db/schema.js';
import type { UpsertClipInput } from '@lib/types/db.js';

const sqlite: Database.Database = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

vi.mock('@lib/services/db/client.js', () => ({ db: testDb }));

const {
  deleteClip,
  deleteClipsByAnalysisId,
  getClip,
  getClipRow,
  listClipsByAnalysisId,
  listClipsByVideoId,
  setClipEdits,
  setClipRender,
  upsertClip,
} = await import('@lib/services/db/repos/clipsRepo.js');

function clipInput(id: string, analysisId: string, videoId: string = 'video-1'): UpsertClipInput {
  return {
    id,
    videoId,
    analysisId,
    segmentationId: `segment-${id}`,
    segmentRank: 1,
    filename: `${id}.mp4`,
    path: `/outputs/${id}.mp4`,
    startSec: 10,
    endSec: 40,
    durationSec: 30,
  };
}

beforeEach(() => {
  sqlite.exec('DELETE FROM clips;');
});

afterAll(() => sqlite.close());

describe('clipsRepo', () => {
  it('persists edit and render state across a regenerated clip upsert', () => {
    const original = upsertClip(clipInput('clip-video-1-first', 'analysis-1'));
    setClipEdits(original.id, '{"crop":{"x":10}}', 'edit-hash');
    setClipRender(original.id, '/outputs/edited.mp4', 'render-hash');

    const regenerated = upsertClip({
      ...clipInput(original.id, 'analysis-1'),
      filename: 'regenerated.mp4',
      path: '/outputs/regenerated.mp4',
    });

    expect(regenerated).toMatchObject({
      filename: 'regenerated.mp4',
      path: '/outputs/regenerated.mp4',
      hasEdits: true,
      editedPath: '/outputs/edited.mp4',
      currentEditsHash: 'edit-hash',
      lastRenderedHash: 'render-hash',
      createdAt: original.createdAt,
    });
    expect(getClipRow(original.id)?.editsJson).toBe('{"crop":{"x":10}}');
  });

  it('scopes lists and replacement cleanup by analysis without touching other clips', () => {
    upsertClip(clipInput('clip-video-1-first', 'analysis-1'));
    upsertClip(clipInput('clip-video-1-second', 'analysis-1'));
    upsertClip(clipInput('clip-video-2-third', 'analysis-2', 'video-2'));

    expect(
      listClipsByAnalysisId('analysis-1')
        .map((clip) => clip.id)
        .sort(),
    ).toEqual(['clip-video-1-first', 'clip-video-1-second']);
    expect(listClipsByVideoId('video-2').map((clip) => clip.id)).toEqual(['clip-video-2-third']);

    expect(deleteClipsByAnalysisId('analysis-1', ['clip-video-1-first'])).toBe(1);
    expect(getClip('clip-video-1-first')).not.toBeNull();
    expect(getClip('clip-video-1-second')).toBeNull();
    expect(getClip('clip-video-2-third')).not.toBeNull();
    expect(deleteClip('clip-video-2-third')).toBe(true);
    expect(deleteClip('clip-video-2-third')).toBe(false);
  });
});
