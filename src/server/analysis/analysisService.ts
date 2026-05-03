import { config } from '../../config/index.js';
import { Cache } from '../../utils/cache.js';
import { createCacheBackend } from '../../utils/cacheFactory.js';
import { analyzeSegments, refineRankedSegments } from '../../pipeline/stages/segmentAnalyzer.js';
import { selectSegments } from '../../pipeline/stages/segmentSelector.js';
import { createArtifactId, saveAnalysis } from '../artifacts/artifactStore.js';
import { ClipPlanSchema } from '../../types/index.js';
import type {
  ClipCandidate,
  ClipPlan,
  CreateAnalysisRequest,
  RankedSegment,
  TranscriptLine,
} from '../../types/index.js';

export async function analyzeTranscriptForWeb(input: CreateAnalysisRequest): Promise<ClipPlan> {
  const backend = await createCacheBackend(config, input.options.noCache);
  const cache = new Cache(backend);

  try {
    const { lines, microBlocks, chunkEvals } = await analyzeSegments(
      videoIdFrom(input),
      null,
      [],
      cache,
      {
        maxChunks: input.options.maxChunks ?? config.MAX_CHUNKS,
        maxParallel: input.options.maxParallel ?? config.LLM_CONCURRENCY,
        noCache: input.options.noCache,
      },
    );

    const rankedSegments = selectSegments(chunkEvals, [], {
      threshold: input.options.threshold ?? config.SCORE_THRESHOLD,
      topN: input.options.topN ?? config.TOP_N_SEGMENTS,
    });

    const finalSegments =
      input.options.refine && rankedSegments.length > 0
        ? await refineRankedSegments(rankedSegments, microBlocks, cache, {
            maxParallel: input.options.maxParallel ?? config.LLM_CONCURRENCY,
            noCache: input.options.noCache,
          })
        : rankedSegments;

    const createdAt = new Date().toISOString();
    const plan = ClipPlanSchema.parse({
      id: createArtifactId(`analysis-${input.videoId}`),
      videoId: input.videoId,
      title: input.title ?? input.videoId,
      durationSec: input.durationSec ?? 0,
      candidates: finalSegments.map((segment) => toClipCandidate(input.videoId, segment, lines)),
      chunkEvaluations: chunkEvals,
      createdAt,
    });

    return saveAnalysis(plan);
  } finally {
    await cache.close();
  }
}

function videoIdFrom(input: CreateAnalysisRequest): string {
  return input.videoId;
}

function toClipCandidate(
  videoId: string,
  segment: RankedSegment,
  lines: TranscriptLine[],
): ClipCandidate {
  const id = `${videoId}-rank-${segment.rank}`;

  return {
    id,
    rank: segment.rank,
    startSec: segment.start,
    endSec: segment.end,
    score: segment.score,
    reason: segment.reason,
    source: segment.source,
    audioEvent: segment.audio_event,
    transcriptExcerpt: excerptForSegment(lines, segment.start, segment.end),
    selected: true,
  };
}

function excerptForSegment(lines: TranscriptLine[], startSec: number, endSec: number): string {
  const text = lines
    .filter((line) => line.start >= Math.max(0, startSec - 3) && line.start <= endSec + 3)
    .map((line) => line.text)
    .join(' ')
    .trim();

  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}
