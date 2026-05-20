import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { uploadArtifacts } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import { UploadArtifactStatusSchema, PublishPrivacyStatusSchema } from '@app/web/types/publish.js';
import type { UploadArtifact } from '@app/web/types/publish.js';

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
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export function upsertUploadArtifact(upload: UploadArtifact): void {
  const done = log.dbCalled('upsertUploadArtifact', undefined, { id: upload.id });
  const now = Date.now();
  db.insert(uploadArtifacts)
    .values({
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
      createdAt: new Date(upload.createdAt).getTime(),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: uploadArtifacts.id,
      set: {
        status: upload.status,
        youtubeVideoId: upload.youtubeVideoId ?? null,
        youtubeUrl: upload.youtubeUrl ?? null,
        error: upload.error ?? null,
        updatedAt: now,
      },
    })
    .run();
  done({});
}

export function listUploadArtifactsByAnalysisId(analysisId: string): UploadArtifact[] {
  const done = log.dbCalled('listUploadArtifactsByAnalysisId', undefined, { analysisId });
  const rows = db
    .select()
    .from(uploadArtifacts)
    .where(eq(uploadArtifacts.analysisId, analysisId))
    .all();
  done({ found: rows.length });
  return rows.map(rowToArtifact).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
