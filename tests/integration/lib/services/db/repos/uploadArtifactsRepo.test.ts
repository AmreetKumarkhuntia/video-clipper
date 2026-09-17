import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { listUploadArtifactsByAnalysisId, upsertUploadArtifacts } from '@lib/services/db/index.js';
import type { UploadArtifact } from '@lib/types/publish.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../../support/postgres.js';
import { seedAnalysis } from '../postgresFixtures.js';

let database: PostgresTestDatabase;

function uploadArtifact(id: string, status: UploadArtifact['status']): UploadArtifact {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return {
    id,
    analysisId: 'analysis-1',
    videoId: 'video-1',
    clipArtifactId: `clip-${id}`,
    title: `Upload ${id}`,
    privacyStatus: 'private',
    status,
    ...(status === 'failed' ? { error: 'upload failed' } : {}),
    createdAt,
    updatedAt: createdAt,
  };
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('upload_artifacts_repo');
});

beforeEach(async () => {
  await database.reset();
  await seedAnalysis(database, 'analysis-1', 'video-1');
});

afterAll(async () => {
  await database.close();
});

describe('uploadArtifactsRepo', () => {
  it('stores a completed upload run as one batch and updates retry outcomes', async () => {
    const failed = uploadArtifact('upload-1', 'failed');
    const uploaded = {
      ...uploadArtifact('upload-2', 'uploaded'),
      youtubeVideoId: 'youtube-2',
      youtubeUrl: 'https://www.youtube.com/watch?v=youtube-2',
    };

    await upsertUploadArtifacts([failed, uploaded]);
    await upsertUploadArtifacts([
      {
        ...failed,
        status: 'uploaded',
        error: undefined,
        youtubeVideoId: 'youtube-1',
        youtubeUrl: 'https://www.youtube.com/watch?v=youtube-1',
      },
    ]);

    const stored = await listUploadArtifactsByAnalysisId('analysis-1');
    expect(stored).toHaveLength(2);
    expect(stored.find((item) => item.id === 'upload-1')).toMatchObject({
      status: 'uploaded',
      youtubeVideoId: 'youtube-1',
    });
    expect(stored.find((item) => item.id === 'upload-1')).not.toHaveProperty('error');
  });

  it('rolls back the whole upload batch when one artifact has an invalid parent', async () => {
    const valid = uploadArtifact('upload-valid', 'uploaded');
    const invalid = {
      ...uploadArtifact('upload-invalid', 'failed'),
      analysisId: 'missing-analysis',
    };

    await expect(upsertUploadArtifacts([valid, invalid])).rejects.toThrow();
    expect(await listUploadArtifactsByAnalysisId('analysis-1')).toEqual([]);
  });
});
