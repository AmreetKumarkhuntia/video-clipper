import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb, withDbTransaction } from '../client.js';
import { chunks } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { ChunkAnalysisUpdate, ChunkInsert, ChunkRecord } from '@lib/types/db.js';
import { ChunkEvaluationSchema } from '@lib/types/segment.js';
import { LLMChunkSchema } from '@lib/types/transcript.js';

function rowToRecord(row: typeof chunks.$inferSelect): ChunkRecord {
  return {
    ...row,
    chunk: JSON.stringify(LLMChunkSchema.parse(row.chunk)),
    analysis:
      row.analysis === null ? null : JSON.stringify(ChunkEvaluationSchema.parse(row.analysis)),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function findChunks(videoId: string): Promise<ChunkRecord[]> {
  const done = log.dbCalled('findChunks', undefined, { videoId });
  const rows = await getDb().select().from(chunks).where(eq(chunks.videoId, videoId));
  done({ count: rows.length });
  return rows.map(rowToRecord);
}

export async function upsertChunks(videoId: string, rows: ChunkInsert[]): Promise<void> {
  const done = log.dbCalled('upsertChunks', undefined, { videoId, count: rows.length });
  const ts = new Date();
  await withDbTransaction(async () => {
    const db = getDb();
    await db.delete(chunks).where(eq(chunks.videoId, videoId));
    if (rows.length === 0) return;
    await db.insert(chunks).values(
      rows.map((row) => ({
        id: nanoid(),
        videoId,
        chunk: LLMChunkSchema.parse(JSON.parse(row.chunk) as unknown),
        analysis:
          row.analysis === undefined
            ? null
            : ChunkEvaluationSchema.parse(JSON.parse(row.analysis) as unknown),
        score: row.score ?? null,
        start: row.start,
        end: row.end,
        rank: row.rank ?? null,
        createdAt: ts,
        updatedAt: ts,
      })),
    );
  });
  done({});
}

export async function deleteChunks(videoId: string): Promise<void> {
  const done = log.dbCalled('deleteChunks', undefined, { videoId });
  await getDb().delete(chunks).where(eq(chunks.videoId, videoId));
  done({});
}

export async function setChunkAnalysisByRange(
  videoId: string,
  start: number,
  end: number,
  analysis: string | null,
  score: number | null,
): Promise<void> {
  await setChunkAnalysesByRange(videoId, [{ start, end, analysis, score }]);
}

/** Atomically persists a completed LLM batch after synchronous stream callbacks finish. */
export async function setChunkAnalysesByRange(
  videoId: string,
  updates: ChunkAnalysisUpdate[],
): Promise<void> {
  if (updates.length === 0) return;
  const done = log.dbCalled('setChunkAnalysesByRange', undefined, {
    videoId,
    count: updates.length,
  });
  await withDbTransaction(async () => {
    const db = getDb();
    const updatedAt = new Date();
    for (const update of updates) {
      await db
        .update(chunks)
        .set({
          analysis:
            update.analysis === null
              ? null
              : ChunkEvaluationSchema.parse(JSON.parse(update.analysis) as unknown),
          score: update.score,
          updatedAt,
        })
        .where(
          and(
            eq(chunks.videoId, videoId),
            eq(chunks.start, update.start),
            eq(chunks.end, update.end),
          ),
        )
        .returning({ id: chunks.id });
    }
  });
  done({});
}

export async function clearChunkAnalysis(videoId: string): Promise<number> {
  const done = log.dbCalled('clearChunkAnalysis', undefined, { videoId });
  const rows = await getDb()
    .update(chunks)
    .set({ analysis: null, score: null, rank: null, updatedAt: new Date() })
    .where(eq(chunks.videoId, videoId))
    .returning({ id: chunks.id });
  done({});
  return rows.length;
}
