import { randomUUID } from 'crypto';
import { Model } from '@lib/services/modelFactory/index.js';
import { analyzeChunks } from '@lib/services/analysis/llm/index.js';
import { refineRankedSegments } from '@lib/pipeline/stages/segmentAnalyzer.js';
import { selectSegments } from '@lib/pipeline/stages/segmentSelector.js';
import { loadOrFetchTranscript } from './transcriptOrchestrator.js';
import { findChunks, setChunkAnalysisByRange } from '@lib/services/db/repos/chunksRepo.js';
import {
  findSegmentations,
  upsertSegmentations,
  clearSegmentations,
  insertSegmentation,
  markSegmentationsComplete,
} from '@lib/services/db/repos/segmentationsRepo.js';
import { saveAnalysisToDb } from '@lib/services/db/repos/analysesRepo.js';
import { ClipPlanSchema } from '@lib/types/analysis.js';
import type { ClipPlan, CreateAnalysisRequest } from '@lib/types/analysis.js';
import {
  ChunkEvaluationSchema,
  type LLMChunk,
  type RankedSegment,
  type ChunkEvaluation,
  type StreamCallbacks,
} from '@lib/types/index.js';
import { toClipCandidate } from '@lib/utils/transcriptUtils.js';
import { DEFAULT_ANALYSIS_SYSTEM_PROMPT } from '@lib/services/analysis/prompts.js';
import type { Config } from '@lib/types/config.js';
import type { AnalyzeChunksOpts } from '@lib/types/analyzer.js';

export function createArtifactId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function buildAnalysisSystemPrompt(
  base: string,
  title?: string,
  channelTitle?: string,
  description?: string,
): string {
  const lines: string[] = [];

  if (title) lines.push(`Video title: ${title}`);
  if (channelTitle) lines.push(`Channel: ${channelTitle}`);
  if (description) {
    const trimmed = description.trim().slice(0, 500);
    lines.push(`Video description (supporting context — transcript is primary):\n${trimmed}`);
  }

  if (lines.length === 0) return base;

  return `${lines.join('\n')}\n\n${base}`;
}

function computeOptionsHash(opts: {
  threshold: number | undefined;
  topN: number | undefined;
  refine: boolean;
  maxChunks: number | undefined;
  noSegmentCache: boolean;
}): string {
  return JSON.stringify({
    maxChunks: opts.maxChunks ?? null,
    noSegmentCache: opts.noSegmentCache,
    refine: opts.refine,
    threshold: opts.threshold ?? null,
    topN: opts.topN ?? null,
  });
}

const DEFAULT_LLM_CONCURRENCY = 3;

const DEFAULT_SYSTEM_PROMPT =
  DEFAULT_ANALYSIS_SYSTEM_PROMPT +
  '\n\nAfter analyzing the segment, call the report_analysis tool with your findings.';

export async function runAnalysis(
  input: CreateAnalysisRequest,
  cfg: Config,
  callbacks?: StreamCallbacks,
  requestId?: string,
  signal?: AbortSignal,
): Promise<ClipPlan> {
  const videoId = input.videoId;
  const noCache = input.options.noCache;
  const noSegmentCache = input.options.noSegmentCache ?? false;
  const maxParallel = input.options.maxParallel ?? DEFAULT_LLM_CONCURRENCY;

  const model = new Model({
    provider: cfg.LLM_PROVIDER,
    model: cfg.LLM_MODEL,
    apiKeys: {
      ZAI_API_KEY: cfg.ZAI_API_KEY,
      OPENROUTER_API_KEY: cfg.OPENROUTER_API_KEY,
      CUSTOM_OPENAI_BASE_URL: cfg.CUSTOM_OPENAI_BASE_URL,
      CUSTOM_OPENAI_API_KEY: cfg.CUSTOM_OPENAI_API_KEY,
    },
  });

  const basePrompt = cfg.LLM_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = cfg.LLM_SYSTEM_PROMPT
    ? basePrompt
    : buildAnalysisSystemPrompt(basePrompt, input.title, input.channelTitle, input.description);

  const { lines, microBlocks, chunks: allChunks } = await loadOrFetchTranscript(videoId, cfg);

  const chunkLimit = input.options.maxChunks ?? cfg.MAX_CHUNKS;
  const chunks: LLMChunk[] = chunkLimit !== undefined ? allChunks.slice(0, chunkLimit) : allChunks;

  const optionsHash = computeOptionsHash({
    threshold: input.options.threshold ?? cfg.SCORE_THRESHOLD,
    topN: input.options.topN ?? cfg.TOP_N_SEGMENTS,
    refine: input.options.refine,
    maxChunks: chunkLimit,
    noSegmentCache,
  });

  const cachedEvals: ChunkEvaluation[] = [];
  const uncachedChunks: LLMChunk[] = [];
  const uncachedGlobalIndices: number[] = [];

  if (noCache) {
    chunks.forEach((chunk, i) => {
      uncachedChunks.push(chunk);
      uncachedGlobalIndices.push(i);
    });
  } else {
    const dbRows = findChunks(videoId);
    const rowMap = new Map(dbRows.map((r) => [`${r.start}:${r.end}`, r]));

    chunks.forEach((chunk, i) => {
      const row = rowMap.get(`${chunk.start}:${chunk.end}`);
      if (row?.analysis) {
        try {
          const parsed = ChunkEvaluationSchema.parse(JSON.parse(row.analysis));
          cachedEvals.push({ ...parsed, chunk_index: i });
        } catch {
          uncachedChunks.push(chunk);
          uncachedGlobalIndices.push(i);
        }
      } else {
        uncachedChunks.push(chunk);
        uncachedGlobalIndices.push(i);
      }
    });
  }

  for (const eval_ of cachedEvals) {
    callbacks?.onChunkStarted?.(eval_.chunk_index);
    callbacks?.onChunkAnalyzed?.(eval_.chunk_index, eval_);
  }

  let freshEvals: ChunkEvaluation[] = [];

  if (uncachedChunks.length > 0) {
    const wrappedCallbacks: AnalyzeChunksOpts['callbacks'] = {
      onChunkStarted: (localIdx: number) =>
        callbacks?.onChunkStarted?.(uncachedGlobalIndices[localIdx]),

      onChunkTextDelta: (localIdx: number, text: string) =>
        callbacks?.onChunkTextDelta?.(uncachedGlobalIndices[localIdx], text),

      onChunkAnalyzed: (localIdx: number, eval_: ChunkEvaluation) => {
        const globalIdx = uncachedGlobalIndices[localIdx];
        const globalEval = { ...eval_, chunk_index: globalIdx };

        if (globalEval.status === 'success') {
          setChunkAnalysisByRange(
            videoId,
            globalEval.chunk_start,
            globalEval.chunk_end,
            JSON.stringify(globalEval),
            globalEval.score,
          );
        }

        callbacks?.onChunkAnalyzed?.(globalIdx, globalEval);
      },
    };

    const analyzeOpts: AnalyzeChunksOpts = {
      maxRetries: cfg.LLM_MAX_RETRIES,
      systemPrompt,
      model,
      requestId,
      signal,
      callbacks: wrappedCallbacks,
    };

    const localEvals = await analyzeChunks(uncachedChunks, lines, [], maxParallel, analyzeOpts);

    freshEvals = localEvals.map((e, localI) => ({
      ...e,
      chunk_index: uncachedGlobalIndices[localI],
    }));

    clearSegmentations(videoId);
  }

  const chunkEvals = [...cachedEvals, ...freshEvals].sort((a, b) => a.chunk_start - b.chunk_start);

  if (chunkEvals.filter((e) => e.status === 'success').length === 0) {
    throw new Error('All chunks failed LLM analysis. Check your API key and model config.');
  }

  const canUseSegmentCache = !noCache && !noSegmentCache && freshEvals.length === 0;

  let finalSegments: RankedSegment[];

  const selectOpts = {
    threshold: input.options.threshold ?? cfg.SCORE_THRESHOLD,
    topN: input.options.topN ?? cfg.TOP_N_SEGMENTS,
    boostWindow: cfg.AUDIO_LLM_BOOST_WINDOW,
    scoreBoost: cfg.AUDIO_LLM_SCORE_BOOST,
    preRoll: cfg.AUDIO_CLIP_PRE_ROLL,
    postRoll: cfg.AUDIO_CLIP_POST_ROLL,
  };

  if (canUseSegmentCache) {
    const cached = findSegmentations(videoId, optionsHash);
    if (cached.length > 0) {
      finalSegments = cached;
    } else {
      finalSegments = await runSegmentation(
        videoId,
        optionsHash,
        chunkEvals,
        microBlocks,
        selectOpts,
        input,
        cfg,
        model,
        maxParallel,
        requestId,
        callbacks,
        signal,
      );
    }
  } else {
    finalSegments = await runSegmentation(
      videoId,
      optionsHash,
      chunkEvals,
      microBlocks,
      selectOpts,
      input,
      cfg,
      model,
      maxParallel,
      requestId,
      callbacks,
      signal,
    );
  }

  const createdAt = new Date().toISOString();
  const plan = ClipPlanSchema.parse({
    id: createArtifactId(`analysis-${videoId}`),
    videoId,
    title: input.title ?? videoId,
    durationSec: input.durationSec ?? 0,
    candidates: finalSegments.map((segment) => toClipCandidate(videoId, segment, lines)),
    chunkEvaluations: chunkEvals,
    createdAt,
  });

  saveAnalysisToDb(plan, optionsHash);
  return plan;
}

async function runSegmentation(
  videoId: string,
  optionsHash: string,
  chunkEvals: ChunkEvaluation[],
  microBlocks: Parameters<typeof refineRankedSegments>[1],
  selectOpts: Parameters<typeof selectSegments>[2],
  input: CreateAnalysisRequest,
  cfg: Config,
  model: Model,
  maxParallel: number,
  requestId: string | undefined,
  callbacks: StreamCallbacks | undefined,
  signal: AbortSignal | undefined,
): Promise<RankedSegment[]> {
  const rankedSegments = selectSegments(chunkEvals, [], selectOpts);

  if (!input.options.refine || rankedSegments.length === 0) {
    upsertSegmentations(videoId, rankedSegments, optionsHash);
    return rankedSegments;
  }

  clearSegmentations(videoId);

  const wrappedRefineCallbacks = {
    onSegmentStarted: (rank: number) => callbacks?.onSegmentStarted?.(rank),

    onSegmentTextDelta: (rank: number, text: string) => callbacks?.onSegmentTextDelta?.(rank, text),

    onSegmentRefined: (rank: number, segment: RankedSegment) => {
      insertSegmentation(videoId, segment, optionsHash);
      callbacks?.onSegmentRefined?.(rank, segment);
    },
  };

  const refined = await refineRankedSegments(rankedSegments, microBlocks, {
    maxParallel,
    maxRetries: cfg.LLM_MAX_RETRIES,
    model,
    requestId,
    videoTitle: input.title,
    callbacks: wrappedRefineCallbacks,
    signal,
  });

  markSegmentationsComplete(videoId);

  return refined;
}
