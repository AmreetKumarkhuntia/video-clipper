import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteClip,
  deleteClipsByAnalysisId,
  getClip,
  getClipRow,
  listClipsByAnalysisId,
  listClipsByVideoId,
  persistGeneratedClips,
  setClipEdits,
  setClipRender,
  upsertClip,
} from '@lib/services/db/index.js';
import type { UpsertClipInput } from '@lib/types/db.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../../support/postgres.js';
import { seedAnalysis, seedSegmentation } from '../postgresFixtures.js';

let database: PostgresTestDatabase;

function clipInput(id: string, analysisId: string, videoId = 'video-1'): UpsertClipInput {
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

async function seedClipParents(input: UpsertClipInput): Promise<void> {
  await seedAnalysis(database, input.analysisId!, input.videoId);
  await seedSegmentation(database, input.segmentationId!, input.videoId);
}

function editsJson(): string {
  return JSON.stringify({
    schemaVersion: 1,
    trim: { startSec: 0, endSec: 30 },
    viewport: {
      preset: '9:16',
      focus: { xCenter: 0.5, yCenter: 0.5 },
      fillMode: 'crop',
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      placement: { offsetX: 0, offsetY: 0, scale: 1 },
    },
    subtitles: [],
    overlays: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('clips_repo');
});

beforeEach(async () => {
  await database.reset();
});

afterAll(async () => {
  await database.close();
});

describe('clipsRepo', () => {
  it('persists JSONB edit and render state across a regenerated clip upsert', async () => {
    const input = clipInput('clip-video-1-first', 'analysis-1');
    await seedClipParents(input);
    const original = await upsertClip(input);
    await setClipEdits(original.id, editsJson(), 'edit-hash');
    await setClipRender(original.id, '/outputs/edited.mp4', 'render-hash');

    const regenerated = await upsertClip({
      ...input,
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
    expect(JSON.parse((await getClipRow(original.id))!.editsJson!)).toMatchObject({
      schemaVersion: 1,
      trim: { startSec: 0, endSec: 30 },
    });
    const stored = await database.query<{ edits_json: unknown }>(
      'select edits_json from clips where id = $1',
      [original.id],
    );
    expect(stored.rows[0]?.edits_json).toMatchObject({ schemaVersion: 1 });
  });

  it('scopes lists and replacement cleanup by analysis without touching other clips', async () => {
    const inputs = [
      clipInput('clip-video-1-first', 'analysis-1'),
      clipInput('clip-video-1-second', 'analysis-1'),
      clipInput('clip-video-2-third', 'analysis-2', 'video-2'),
    ];
    for (const input of inputs) {
      await seedClipParents(input);
      await upsertClip(input);
    }

    expect((await listClipsByAnalysisId('analysis-1')).map((clip) => clip.id).sort()).toEqual([
      'clip-video-1-first',
      'clip-video-1-second',
    ]);
    expect((await listClipsByVideoId('video-2')).map((clip) => clip.id)).toEqual([
      'clip-video-2-third',
    ]);

    expect(await deleteClipsByAnalysisId('analysis-1', ['clip-video-1-first'])).toBe(1);
    expect(await getClip('clip-video-1-first')).not.toBeNull();
    expect(await getClip('clip-video-1-second')).toBeNull();
    expect(await getClip('clip-video-2-third')).not.toBeNull();
    expect(await deleteClip('clip-video-2-third')).toBe(true);
    expect(await deleteClip('clip-video-2-third')).toBe(false);
  });

  it('persists a generated batch and removes stale rows in one replacement', async () => {
    const kept = clipInput('clip-video-1-first', 'analysis-1');
    const stale = clipInput('clip-video-1-second', 'analysis-1');
    const unrelated = clipInput('clip-video-2-third', 'analysis-2', 'video-2');
    for (const input of [kept, stale, unrelated]) {
      await seedClipParents(input);
      await upsertClip(input);
    }
    await setClipRender(stale.id, '/outputs/stale-edited.mp4', 'stale-render-hash');

    const result = await persistGeneratedClips(
      [{ ...kept, filename: 'regenerated.mp4', path: '/outputs/regenerated.mp4' }],
      'analysis-1',
    );

    expect(result.saved).toEqual([
      expect.objectContaining({ id: kept.id, filename: 'regenerated.mp4' }),
    ]);
    expect(result.stale).toEqual([
      expect.objectContaining({ id: stale.id, editedPath: '/outputs/stale-edited.mp4' }),
    ]);
    expect(await getClip(stale.id)).toBeNull();
    expect(await getClip(unrelated.id)).not.toBeNull();
  });

  it('rolls back stale cleanup when any generated clip cannot be persisted', async () => {
    const existing = clipInput('clip-video-1-existing', 'analysis-1');
    await seedClipParents(existing);
    await upsertClip(existing);

    await expect(
      persistGeneratedClips(
        [clipInput('clip-missing-video-invalid', 'analysis-1', 'missing-video')],
        'analysis-1',
      ),
    ).rejects.toThrow();

    expect(await getClip(existing.id)).not.toBeNull();
  });

  it('sets analysis and segmentation references null and cascades with the owning video', async () => {
    const input = clipInput('clip-video-1-first', 'analysis-1');
    await seedClipParents(input);
    await upsertClip(input);

    await database.query('delete from analyses where id = $1', [input.analysisId]);
    await database.query('delete from segmentations where id = $1', [input.segmentationId]);
    expect(await getClipRow(input.id)).toMatchObject({
      analysisId: null,
      segmentationId: null,
    });

    await database.query('delete from videos where id = $1', [input.videoId]);
    expect(await getClip(input.id)).toBeNull();
  });
});
