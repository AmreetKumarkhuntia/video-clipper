import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../client.js';
import { chunks } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { ChunkInsert } from '@lib/types/db.js';

export function findChunks(videoId: string): (typeof chunks.$inferSelect)[] {
  const done = log.dbCalled('findChunks', undefined, { videoId });
  const rows = db.select().from(chunks).where(eq(chunks.videoId, videoId)).all();
  done({ count: rows.length });
  return rows;
}

export function upsertChunks(videoId: string, rows: ChunkInsert[]): void {
  const done = log.dbCalled('upsertChunks', undefined, { videoId, count: rows.length });
  db.delete(chunks).where(eq(chunks.videoId, videoId)).run();
  const ts = Date.now();
  for (const row of rows) {
    db.insert(chunks)
      .values({
        id: nanoid(),
        videoId: row.videoId,
        chunk: row.chunk,
        analysis: row.analysis ?? null,
        score: row.score ?? null,
        start: row.start,
        end: row.end,
        rank: row.rank ?? null,
        createdAt: ts,
        updatedAt: ts,
      })
      .run();
  }
  done({});
}

export function deleteChunks(videoId: string): void {
  const done = log.dbCalled('deleteChunks', undefined, { videoId });
  db.delete(chunks).where(eq(chunks.videoId, videoId)).run();
  done({});
}

export function setChunkAnalysisByRange(
  videoId: string,
  start: number,
  end: number,
  analysis: string | null,
  score: number | null,
): void {
  const done = log.dbCalled('setChunkAnalysisByRange', undefined, { videoId, start, end });
  db.update(chunks)
    .set({ analysis, score, updatedAt: Date.now() })
    .where(and(eq(chunks.videoId, videoId), eq(chunks.start, start), eq(chunks.end, end)))
    .run();
  done({});
}

export function clearChunkAnalysis(videoId: string): number {
  const done = log.dbCalled('clearChunkAnalysis', undefined, { videoId });
  const result = db
    .update(chunks)
    .set({ analysis: null, score: null, rank: null, updatedAt: Date.now() })
    .where(eq(chunks.videoId, videoId))
    .run();
  done({});
  return result.changes ?? 0;
}
