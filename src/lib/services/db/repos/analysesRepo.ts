import { eq, desc } from 'drizzle-orm';
import { db } from '../client.js';
import { analyses } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import { ClipPlanSchema } from '@lib/types/analysis.js';
import type { ClipPlan } from '@lib/types/analysis.js';
import { ChunkEvaluationSchema } from '@lib/types/index.js';
import { findSegmentations } from './segmentationsRepo.js';
import { findTranscriptLines } from './videosRepo.js';
import { findChunks } from './chunksRepo.js';
import { toClipCandidate } from '@lib/utils/transcriptUtils.js';

function reconstruct(row: typeof analyses.$inferSelect): ClipPlan {
  const segments = findSegmentations(row.videoId, row.optionsHash);
  const transcriptResult = findTranscriptLines(row.videoId);
  const lines = transcriptResult?.lines ?? [];

  const candidates = segments
    .sort((a, b) => a.rank - b.rank)
    .map((seg) => toClipCandidate(row.videoId, seg, lines));

  const chunkRows = findChunks(row.videoId);
  const chunkEvaluations = chunkRows
    .filter((r) => r.analysis != null)
    .sort((a, b) => a.start - b.start)
    .map((r, i) => {
      try {
        const parsed = ChunkEvaluationSchema.parse(JSON.parse(r.analysis!));
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

export function saveAnalysisToDb(plan: ClipPlan, optionsHash: string): void {
  const now = Date.now();
  const done = log.dbCalled('saveAnalysis', undefined, { videoId: plan.videoId, id: plan.id });
  db.insert(analyses)
    .values({
      id: plan.id,
      videoId: plan.videoId,
      title: plan.title,
      durationSec: plan.durationSec,
      optionsHash,
      createdAt: new Date(plan.createdAt).getTime(),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: analyses.id,
      set: { title: plan.title, durationSec: plan.durationSec, optionsHash, updatedAt: now },
    })
    .run();
  done({});
}

export function getAnalysisFromDb(analysisId: string): ClipPlan | null {
  const done = log.dbCalled('getAnalysis', undefined, { analysisId });
  const row = db.select().from(analyses).where(eq(analyses.id, analysisId)).get();
  done({ found: row != null });
  if (!row) return null;
  return reconstruct(row);
}

export function getLatestAnalysisByVideoId(videoId: string): ClipPlan | null {
  const done = log.dbCalled('getLatestAnalysisByVideoId', undefined, { videoId });
  const row = db
    .select()
    .from(analyses)
    .where(eq(analyses.videoId, videoId))
    .orderBy(desc(analyses.createdAt))
    .limit(1)
    .get();
  done({ found: row != null });
  if (!row) return null;
  return reconstruct(row);
}

export function listAnalysesFromDb(): ClipPlan[] {
  const done = log.dbCalled('listAnalyses', undefined, {});
  const rows = db.select().from(analyses).orderBy(desc(analyses.createdAt)).all();
  done({ count: rows.length });
  return rows.map(reconstruct);
}
