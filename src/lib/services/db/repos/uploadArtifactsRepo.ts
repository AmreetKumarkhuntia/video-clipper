import { eq, sql } from 'drizzle-orm';
import { getDb } from '../client.js';
import { uploadArtifacts } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import { UploadArtifactStatusSchema, PublishPrivacyStatusSchema } from '@lib/types/publish.js';
import type { UploadArtifact } from '@lib/types/publish.js';

function rowToArtifact(row: typeof uploadArtifacts.$inferSelect): UploadArtifact {
  return {
    id: row.id,
    analysisId: row.analysisId,
    videoId: row.videoId,
    clipArtifactId: row.clipArtifactId,
    title: row.title,
    privacyStatus: PublishPrivacyStatusSchema.parse(row.privacyStatus),
    status: UploadArtifactStatusSchema.parse(row.status),
    ...(row.youtubeVideoId ? { youtubeVideoId: row.youtubeVideoId } : {}),
    ...(row.youtubeUrl ? { youtubeUrl: row.youtubeUrl } : {}),
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertUploadArtifact(upload: UploadArtifact): Promise<void> {
  await upsertUploadArtifacts([upload]);
}

/** Stores an upload run in one PostgreSQL statement after all remote uploads finish. */
export async function upsertUploadArtifacts(uploads: UploadArtifact[]): Promise<void> {
  const done = log.dbCalled('upsertUploadArtifacts', undefined, { count: uploads.length });
  if (uploads.length === 0) {
    done({});
    return;
  }
  const now = new Date();
  await getDb()
    .insert(uploadArtifacts)
    .values(
      uploads.map((upload) => ({
        id: upload.id,
        analysisId: upload.analysisId,
        videoId: upload.videoId,
        clipArtifactId: upload.clipArtifactId,
        title: upload.title,
        privacyStatus: upload.privacyStatus,
        status: upload.status,
        youtubeVideoId: upload.youtubeVideoId ?? null,
        youtubeUrl: upload.youtubeUrl ?? null,
        error: upload.error ?? null,
        createdAt: new Date(upload.createdAt),
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: uploadArtifacts.id,
      set: {
        status: sql.raw(`excluded.${uploadArtifacts.status.name}`),
        youtubeVideoId: sql.raw(`excluded.${uploadArtifacts.youtubeVideoId.name}`),
        youtubeUrl: sql.raw(`excluded.${uploadArtifacts.youtubeUrl.name}`),
        error: sql.raw(`excluded.${uploadArtifacts.error.name}`),
        updatedAt: now,
      },
    })
    .returning({ id: uploadArtifacts.id });
  done({});
}

export async function listUploadArtifactsByAnalysisId(
  analysisId: string,
): Promise<UploadArtifact[]> {
  const done = log.dbCalled('listUploadArtifactsByAnalysisId', undefined, { analysisId });
  const rows = await getDb()
    .select()
    .from(uploadArtifacts)
    .where(eq(uploadArtifacts.analysisId, analysisId));
  done({ found: rows.length });
  return rows.map(rowToArtifact).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
