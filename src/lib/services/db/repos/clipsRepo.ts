import { eq, inArray, sql } from 'drizzle-orm';
import { getDb, withDbTransaction } from '../client.js';
import { clips } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { ClipArtifact } from '@lib/types/analysis.js';
import type { ClipRowRecord, UpsertClipInput } from '@lib/types/db.js';
import { ClipEditsSchema } from '@lib/types/clipEdit.js';

function editsToJson(value: unknown, clipId: string): string | null {
  if (value === null) return null;
  const stored = value !== null && typeof value === 'object' ? value : {};
  const parsed = ClipEditsSchema.parse({ ...stored, clipId });
  // clipId is the row key and is deliberately not duplicated in JSONB.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clipId: _clipId, ...edits } = parsed;
  return JSON.stringify(edits);
}

function rowToRecord(row: typeof clips.$inferSelect): ClipRowRecord {
  return {
    ...row,
    editsJson: editsToJson(row.editsJson, row.id),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

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
    createdAt: row.createdAt.toISOString(),
    hasEdits: !!row.editsJson,
    ...(row.editedPath ? { editedPath: row.editedPath } : {}),
    ...(row.currentEditsHash ? { currentEditsHash: row.currentEditsHash } : {}),
    ...(row.lastRenderedHash ? { lastRenderedHash: row.lastRenderedHash } : {}),
  };
}

function insertValues(input: UpsertClipInput, createdAt: Date): typeof clips.$inferInsert {
  return {
    id: input.id,
    videoId: input.videoId,
    analysisId: input.analysisId ?? null,
    segmentationId: input.segmentationId ?? null,
    segmentRank: input.segmentRank,
    filename: input.filename,
    path: input.path,
    editedPath: null,
    editsJson: null,
    currentEditsHash: null,
    lastRenderedHash: null,
    startSec: input.startSec,
    endSec: input.endSec,
    durationSec: input.durationSec,
    createdAt,
    updatedAt: createdAt,
  };
}

async function upsertClipRows(inputs: UpsertClipInput[]): Promise<(typeof clips.$inferSelect)[]> {
  if (inputs.length === 0) return [];
  const ts = new Date();
  return getDb()
    .insert(clips)
    .values(inputs.map((input) => insertValues(input, ts)))
    .onConflictDoUpdate({
      target: clips.id,
      set: {
        videoId: sql.raw(`excluded.${clips.videoId.name}`),
        analysisId: sql.raw(`excluded.${clips.analysisId.name}`),
        segmentationId: sql.raw(`excluded.${clips.segmentationId.name}`),
        segmentRank: sql.raw(`excluded.${clips.segmentRank.name}`),
        filename: sql.raw(`excluded.${clips.filename.name}`),
        path: sql.raw(`excluded.${clips.path.name}`),
        startSec: sql.raw(`excluded.${clips.startSec.name}`),
        endSec: sql.raw(`excluded.${clips.endSec.name}`),
        durationSec: sql.raw(`excluded.${clips.durationSec.name}`),
        updatedAt: ts,
      },
    })
    .returning();
}

export async function getClipRow(clipId: string): Promise<ClipRowRecord | undefined> {
  const done = log.dbCalled('getClipRow', undefined, { clipId });
  const [row] = await getDb().select().from(clips).where(eq(clips.id, clipId)).limit(1);
  done({ found: row ? 1 : 0 });
  return row ? rowToRecord(row) : undefined;
}

export async function getClip(clipId: string): Promise<ClipArtifact | null> {
  const [row] = await getDb().select().from(clips).where(eq(clips.id, clipId)).limit(1);
  return row ? rowToArtifact(row) : null;
}

export async function listClips(): Promise<ClipArtifact[]> {
  const rows = await getDb().select().from(clips);
  return rows.map(rowToArtifact).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listClipsByAnalysisId(analysisId: string): Promise<ClipArtifact[]> {
  const rows = await getDb().select().from(clips).where(eq(clips.analysisId, analysisId));
  return rows.map(rowToArtifact).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listClipsByVideoId(videoId: string): Promise<ClipArtifact[]> {
  const rows = await getDb().select().from(clips).where(eq(clips.videoId, videoId));
  return rows.map(rowToArtifact).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Insert or update a freshly-generated clip. Preserves edits/render fields if a row already exists. */
export async function upsertClip(input: UpsertClipInput): Promise<ClipArtifact> {
  const [row] = await upsertClipRows([input]);
  return rowToArtifact(row!);
}

/**
 * Atomically stores one generated clip set and removes stale rows for its analysis.
 * File cleanup deliberately happens in the orchestrator after this database transaction commits.
 */
export async function persistGeneratedClips(
  inputs: UpsertClipInput[],
  analysisId?: string,
): Promise<{ saved: ClipArtifact[]; stale: ClipRowRecord[] }> {
  if (analysisId && inputs.some((input) => input.analysisId !== analysisId)) {
    throw new Error('Every generated clip must belong to the replacement analysis.');
  }

  return withDbTransaction(async () => {
    const savedRows = await upsertClipRows(inputs);
    if (!analysisId) {
      return { saved: savedRows.map(rowToArtifact), stale: [] };
    }

    const analysisRows = await getDb().select().from(clips).where(eq(clips.analysisId, analysisId));
    const keepIds = new Set(inputs.map((input) => input.id));
    const staleRows = analysisRows.filter((row) => !keepIds.has(row.id));
    if (staleRows.length > 0) {
      await getDb()
        .delete(clips)
        .where(
          inArray(
            clips.id,
            staleRows.map((row) => row.id),
          ),
        );
    }

    const savedById = new Map(savedRows.map((row) => [row.id, row]));
    return {
      saved: inputs.map((input) => rowToArtifact(savedById.get(input.id)!)),
      stale: staleRows.map(rowToRecord),
    };
  });
}

export async function setClipEdits(
  clipId: string,
  editsJson: string,
  currentEditsHash: string,
): Promise<void> {
  const parsed = ClipEditsSchema.parse({
    ...(JSON.parse(editsJson) as Record<string, unknown>),
    clipId,
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clipId: _clipId, ...stored } = parsed;
  await getDb()
    .update(clips)
    .set({ editsJson: stored, currentEditsHash, updatedAt: new Date() })
    .where(eq(clips.id, clipId))
    .returning({ id: clips.id });
}

export async function setClipRender(
  clipId: string,
  editedPath: string,
  lastRenderedHash: string,
): Promise<void> {
  await getDb()
    .update(clips)
    .set({ editedPath, lastRenderedHash, updatedAt: new Date() })
    .where(eq(clips.id, clipId))
    .returning({ id: clips.id });
}

export async function deleteClip(clipId: string): Promise<boolean> {
  const rows = await getDb().delete(clips).where(eq(clips.id, clipId)).returning({ id: clips.id });
  return rows.length > 0;
}

export async function deleteClipsByAnalysisId(
  analysisId: string,
  keepIds: string[] = [],
): Promise<number> {
  return withDbTransaction(async () => {
    const db = getDb();
    const rows = await db
      .select({ id: clips.id })
      .from(clips)
      .where(eq(clips.analysisId, analysisId));
    const keep = new Set(keepIds);
    const toDelete = rows.map((r) => r.id).filter((id) => !keep.has(id));
    if (toDelete.length === 0) return 0;
    const deleted = await db
      .delete(clips)
      .where(inArray(clips.id, toDelete))
      .returning({ id: clips.id });
    return deleted.length;
  });
}
