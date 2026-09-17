import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../client.js';
import { analyses, chunks, segmentations, videos } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import { ClipPlanSchema } from '@lib/types/analysis.js';
import type { ClipPlan } from '@lib/types/analysis.js';
import { ChunkEvaluationSchema } from '@lib/types/index.js';
import { toClipCandidate } from '@lib/utils/transcriptUtils.js';
import { TranscriptLineSchema } from '@lib/types/transcript.js';
import type { TranscriptLine } from '@lib/types/transcript.js';
import type { RankedSegment } from '@lib/types/segment.js';

function reconstruct(
  row: typeof analyses.$inferSelect,
  segmentRows: (typeof segmentations.$inferSelect)[],
  lines: TranscriptLine[],
  chunkRows: (typeof chunks.$inferSelect)[],
): ClipPlan {
  const candidates = segmentRows
    .map(
      (segment): RankedSegment => ({
        rank: segment.rank,
        start: segment.startSec,
        end: segment.endSec,
        score: segment.score,
        reason: segment.reason,
        source: segment.source as RankedSegment['source'],
        audio_event: segment.audioEvent ?? undefined,
      }),
    )
    .sort((a, b) => a.rank - b.rank)
    .map((seg) => toClipCandidate(row.videoId, seg, lines));

  const chunkEvaluations = chunkRows
    .filter((r) => r.analysis != null)
    .sort((a, b) => a.start - b.start)
    .map((r, i) => {
      try {
        const parsed = ChunkEvaluationSchema.parse(r.analysis);
        return { ...parsed, chunk_index: i };
      } catch {
        return null;
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  return ClipPlanSchema.parse({
    id: row.id,
    videoId: row.videoId,
    title: row.title,
    durationSec: row.durationSec,
    candidates,
    chunkEvaluations,
    createdAt: new Date(row.createdAt).toISOString(),
  });
}

async function reconstructOne(row: typeof analyses.$inferSelect): Promise<ClipPlan> {
  const [segmentRows, [video], chunkRows] = await Promise.all([
    getDb()
      .select()
      .from(segmentations)
      .where(
        and(
          eq(segmentations.videoId, row.videoId),
          eq(segmentations.optionsHash, row.optionsHash),
          eq(segmentations.completed, true),
        ),
      ),
    getDb().select().from(videos).where(eq(videos.id, row.videoId)).limit(1),
    getDb().select().from(chunks).where(eq(chunks.videoId, row.videoId)),
  ]);
  const lines = video?.transcriptLines
    ? TranscriptLineSchema.array().parse(video.transcriptLines)
    : [];
  return reconstruct(row, segmentRows, lines, chunkRows);
}

export async function saveAnalysisToDb(plan: ClipPlan, optionsHash: string): Promise<void> {
  const now = new Date();
  const done = log.dbCalled('saveAnalysis', undefined, { videoId: plan.videoId, id: plan.id });
  await getDb()
    .insert(analyses)
    .values({
      id: plan.id,
      videoId: plan.videoId,
      title: plan.title,
      durationSec: plan.durationSec,
      optionsHash,
      createdAt: new Date(plan.createdAt),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: analyses.id,
      set: { title: plan.title, durationSec: plan.durationSec, optionsHash, updatedAt: now },
    })
    .returning({ id: analyses.id });
  done({});
}

export async function getAnalysisFromDb(analysisId: string): Promise<ClipPlan | null> {
  const done = log.dbCalled('getAnalysis', undefined, { analysisId });
  const [row] = await getDb().select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  done({ found: row != null });
  if (!row) return null;
  return reconstructOne(row);
}

export async function getLatestAnalysisByVideoId(videoId: string): Promise<ClipPlan | null> {
  const done = log.dbCalled('getLatestAnalysisByVideoId', undefined, { videoId });
  const [row] = await getDb()
    .select()
    .from(analyses)
    .where(eq(analyses.videoId, videoId))
    .orderBy(desc(analyses.createdAt))
    .limit(1);
  done({ found: row != null });
  if (!row) return null;
  return reconstructOne(row);
}

export async function listAnalysesFromDb(): Promise<ClipPlan[]> {
  const done = log.dbCalled('listAnalyses', undefined, {});
  const rows = await getDb().select().from(analyses).orderBy(desc(analyses.createdAt));
  done({ count: rows.length });
  if (rows.length === 0) return [];

  const videoIds = [...new Set(rows.map((row) => row.videoId))];
  const [segmentRows, videoRows, chunkRows] = await Promise.all([
    getDb()
      .select()
      .from(segmentations)
      .where(and(inArray(segmentations.videoId, videoIds), eq(segmentations.completed, true))),
    getDb().select().from(videos).where(inArray(videos.id, videoIds)),
    getDb().select().from(chunks).where(inArray(chunks.videoId, videoIds)),
  ]);
  const videosById = new Map(videoRows.map((video) => [video.id, video]));

  return rows.map((row) => {
    const video = videosById.get(row.videoId);
    const lines = video?.transcriptLines
      ? TranscriptLineSchema.array().parse(video.transcriptLines)
      : [];
    return reconstruct(
      row,
      segmentRows.filter(
        (segment) => segment.videoId === row.videoId && segment.optionsHash === row.optionsHash,
      ),
      lines,
      chunkRows.filter((chunk) => chunk.videoId === row.videoId),
    );
  });
}
