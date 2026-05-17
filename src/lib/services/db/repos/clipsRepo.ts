import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { clips } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { ClipArtifact } from '@app/web/types/analysis.js';
import type { UpsertClipInput } from '@lib/types/db.js';

function rowToArtifact(row: typeof clips.$inferSelect): ClipArtifact {
  return {
    id: row.id,
    videoId: row.videoId,
    ...(row.analysisId ? { analysisId: row.analysisId } : {}),
    segmentId: row.id.replace(`clip-${row.videoId}-`, ''),
    filename: row.filename,
    path: row.path,
    startSec: row.startSec,
    endSec: row.endSec,
    durationSec: row.durationSec,
    createdAt: new Date(row.createdAt).toISOString(),
    hasEdits: !!row.editsJson,
    ...(row.editedPath ? { editedPath: row.editedPath } : {}),
    ...(row.currentEditsHash ? { currentEditsHash: row.currentEditsHash } : {}),
    ...(row.lastRenderedHash ? { lastRenderedHash: row.lastRenderedHash } : {}),
  };
}

export function getClipRow(clipId: string): typeof clips.$inferSelect | undefined {
  const done = log.dbCalled('getClipRow', undefined, { clipId });
  const row = db.select().from(clips).where(eq(clips.id, clipId)).get();
  done({ found: row ? 1 : 0 });
  return row;
}

export function getClip(clipId: string): ClipArtifact | null {
  const row = getClipRow(clipId);
  return row ? rowToArtifact(row) : null;
}

export function listClips(): ClipArtifact[] {
  const rows = db.select().from(clips).all();
  return rows.map(rowToArtifact).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listClipsByAnalysisId(analysisId: string): ClipArtifact[] {
  const rows = db.select().from(clips).where(eq(clips.analysisId, analysisId)).all();
  return rows.map(rowToArtifact).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listClipsByVideoId(videoId: string): ClipArtifact[] {
  const rows = db.select().from(clips).where(eq(clips.videoId, videoId)).all();
  return rows.map(rowToArtifact).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Insert or update a freshly-generated clip. Preserves edits/render fields if a row already exists. */
export function upsertClip(input: UpsertClipInput): ClipArtifact {
  const ts = Date.now();
  const existing = getClipRow(input.id);
  db.insert(clips)
    .values({
      id: input.id,
      videoId: input.videoId,
      analysisId: input.analysisId ?? null,
      segmentationId: input.segmentationId ?? null,
      segmentRank: input.segmentRank,
      filename: input.filename,
      path: input.path,
      editedPath: existing?.editedPath ?? null,
      editsJson: existing?.editsJson ?? null,
      currentEditsHash: existing?.currentEditsHash ?? null,
      lastRenderedHash: existing?.lastRenderedHash ?? null,
      startSec: input.startSec,
      endSec: input.endSec,
      durationSec: input.durationSec,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: clips.id,
      set: {
        videoId: input.videoId,
        analysisId: input.analysisId ?? null,
        segmentationId: input.segmentationId ?? null,
        segmentRank: input.segmentRank,
        filename: input.filename,
        path: input.path,
        startSec: input.startSec,
        endSec: input.endSec,
        durationSec: input.durationSec,
        updatedAt: ts,
      },
    })
    .run();
  return getClip(input.id)!;
}

export function setClipEdits(clipId: string, editsJson: string, currentEditsHash: string): void {
  db.update(clips)
    .set({ editsJson, currentEditsHash, updatedAt: Date.now() })
    .where(eq(clips.id, clipId))
    .run();
}

export function setClipRender(clipId: string, editedPath: string, lastRenderedHash: string): void {
  db.update(clips)
    .set({ editedPath, lastRenderedHash, updatedAt: Date.now() })
    .where(eq(clips.id, clipId))
    .run();
}

export function deleteClip(clipId: string): boolean {
  const result = db.delete(clips).where(eq(clips.id, clipId)).run();
  return (result.changes ?? 0) > 0;
}

export function deleteClipsByAnalysisId(analysisId: string, keepIds: string[] = []): number {
  const rows = db
    .select({ id: clips.id })
    .from(clips)
    .where(eq(clips.analysisId, analysisId))
    .all();
  const keep = new Set(keepIds);
  const toDelete = rows.map((r) => r.id).filter((id) => !keep.has(id));
  for (const id of toDelete) db.delete(clips).where(eq(clips.id, id)).run();
  return toDelete.length;
}
