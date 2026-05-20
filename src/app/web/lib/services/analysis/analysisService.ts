import { getModel } from '@lib/services/modelFactory/index.js';
import { analyzeChunks } from '@lib/services/analysis/llm/index.js';
import { refineRankedSegments } from '@lib/pipeline/stages/segmentAnalyzer.js';
import { selectSegments } from '@lib/pipeline/stages/segmentSelector.js';
import { loadOrFetchTranscript } from '@app/web/lib/services/analysis/transcriptService.js';
import { findChunks, setChunkAnalysisByRange } from '@lib/services/db/repos/chunksRepo.js';
import {
  findSegmentations,
  upsertSegmentations,
  clearSegmentations,
  insertSegmentation,
  markSegmentationsComplete,
} from '@lib/services/db/repos/segmentationsRepo.js';
import { createArtifactId, saveAnalysis } from '@app/web/lib/services/artifacts/artifactStore.js';
import { ClipPlanSchema } from '@app/web/types/analysis.js';
import type { ClipPlan, CreateAnalysisRequest } from '@app/web/types/analysis.js';
import {
  ChunkEvaluationSchema,
  type LLMChunk,
  type RankedSegment,
  type TranscriptLine,
  type ChunkEvaluation,
  type StreamCallbacks,
} from '@lib/types/index.js';
import { toClipCandidate } from '@lib/utils/transcriptUtils.js';
import type { Config } from '@lib/types/config.js';
import type { AnalyzeChunksOpts } from '@lib/types/analyzer.js';

const DEFAULT_SYSTEM_PROMPT = `You are an expert video editor analyzing a YouTube transcript segment.

Identify if this segment contains a potentially interesting moment worth clipping.

Interesting moments include:
- surprising insights or revelations
- strong or controversial opinions
- humor or entertaining storytelling
- emotional moments
- key explanations of important concepts
- "aha" moments or turning points

If audio events are listed in the segment, treat them as strong positive signals —
they indicate high-action or high-energy moments that are often clip-worthy.

After analyzing the segment, call the report_analysis tool with your findings.`;

/**
 * Builds a system prompt that prepends source video context (title, channel, description)
 * before the base scoring instructions. All fields are optional — if none are provided
 * the base prompt is returned unchanged.
 */
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

/**
 * Returns a stable JSON string that fingerprints the segmentation options.
 * Used as the cache key — any change in these values produces a cache miss.
 */
function computeOptionsHash(opts: {
  threshold: number | undefined;
  topN: number | undefined;
  refine: boolean;
  maxChunks: number | undefined;
}): string {
  return JSON.stringify({
    maxChunks: opts.maxChunks ?? null,
    refine: opts.refine,
    threshold: opts.threshold ?? null,
    topN: opts.topN ?? null,
  });
}

const DEFAULT_WEB_LLM_CONCURRENCY = 3;

export async function analyzeTranscriptForWeb(
  input: CreateAnalysisRequest,
  cfg: Config,
  callbacks?: StreamCallbacks,
  requestId?: string,
  signal?: AbortSignal,
): Promise<ClipPlan> {
  const videoId = input.videoId;
  const noCache = input.options.noCache;
  const maxParallel = input.options.maxParallel ?? DEFAULT_WEB_LLM_CONCURRENCY;

  const model = getModel(cfg.LLM_PROVIDER, cfg.LLM_MODEL, {
    ZAI_API_KEY: cfg.ZAI_API_KEY,
    OPENROUTER_API_KEY: cfg.OPENROUTER_API_KEY,
    CUSTOM_OPENAI_BASE_URL: cfg.CUSTOM_OPENAI_BASE_URL,
    CUSTOM_OPENAI_API_KEY: cfg.CUSTOM_OPENAI_API_KEY,
  });

  const basePrompt = cfg.LLM_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = cfg.LLM_SYSTEM_PROMPT
    ? basePrompt
    : buildAnalysisSystemPrompt(basePrompt, input.title, input.channelTitle, input.description);

  // ── Step 1: transcript (DB-first) ─────────────────────────────────────────
  const { lines, microBlocks, chunks: allChunks } = await loadOrFetchTranscript(videoId, cfg);

  // ── Step 2: apply maxChunks limit ─────────────────────────────────────────
  const chunkLimit = input.options.maxChunks ?? cfg.MAX_CHUNKS;
  const chunks: LLMChunk[] = chunkLimit !== undefined ? allChunks.slice(0, chunkLimit) : allChunks;

  // ── Step 3: compute options fingerprint for segmentation cache ─────────────
  const optionsHash = computeOptionsHash({
    threshold: input.options.threshold ?? cfg.SCORE_THRESHOLD,
    topN: input.options.topN ?? cfg.TOP_N_SEGMENTS,
    refine: input.options.refine,
    maxChunks: chunkLimit,
  });

  // ── Step 4: partition into cached / uncached ───────────────────────────────
  const cachedEvals: ChunkEvaluation[] = [];
  const uncachedChunks: LLMChunk[] = [];
  const uncachedGlobalIndices: number[] = [];

  if (noCache) {
    // Skip DB read — analyze everything and overwrite existing rows
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
          // Corrupt DB entry — treat as uncached
          uncachedChunks.push(chunk);
          uncachedGlobalIndices.push(i);
        }
      } else {
        uncachedChunks.push(chunk);
        uncachedGlobalIndices.push(i);
      }
    });
  }

  // ── Step 5: fire instant callbacks for cached chunks ──────────────────────
  for (const eval_ of cachedEvals) {
    callbacks?.onChunkStarted?.(eval_.chunk_index);
    callbacks?.onChunkAnalyzed?.(eval_.chunk_index, eval_);
  }

  // ── Step 6: analyze uncached chunks ───────────────────────────────────────
  let freshEvals: ChunkEvaluation[] = [];

  if (uncachedChunks.length > 0) {
    // Always create wrappedCallbacks — DB writes happen per-chunk regardless of
    // whether a user-facing stream listener is attached.
    const wrappedCallbacks: AnalyzeChunksOpts['callbacks'] = {
      onChunkStarted: (localIdx: number) =>
        callbacks?.onChunkStarted?.(uncachedGlobalIndices[localIdx]),

      onChunkTextDelta: (localIdx: number, text: string) =>
        callbacks?.onChunkTextDelta?.(uncachedGlobalIndices[localIdx], text),

      onChunkAnalyzed: (localIdx: number, eval_: ChunkEvaluation) => {
        const globalIdx = uncachedGlobalIndices[localIdx];
        const globalEval = { ...eval_, chunk_index: globalIdx };

        // Persist immediately — don't wait for the full batch to complete
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

    // ── Step 7: fix chunk_index to global position ───────────────────────────
    // DB writes already happened per-chunk above; just collect for downstream logic.
    freshEvals = localEvals.map((e, localI) => ({
      ...e,
      chunk_index: uncachedGlobalIndices[localI],
    }));

    // Fresh chunk analysis → cached segmentations are stale; clear them
    clearSegmentations(videoId);
  }

  // ── Step 8: merge cached + fresh, sorted by chunk_start ───────────────────
  const chunkEvals = [...cachedEvals, ...freshEvals].sort((a, b) => a.chunk_start - b.chunk_start);

  if (chunkEvals.filter((e) => e.status === 'success').length === 0) {
    throw new Error('All chunks failed LLM analysis. Check your API key and model config.');
  }

  // ── Step 9: segmentation — DB-first ───────────────────────────────────────
  // Use cached segmentations only when:
  //   - noCache is false (skip DB read on noCache=true)
  //   - no fresh chunk analysis ran (if chunks changed, rankings may differ)
  const canUseSegmentCache = !noCache && freshEvals.length === 0;

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
    // noCache=true OR fresh chunk analysis ran — always re-run and overwrite
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

  // ── Step 10: build ClipPlan + persist ─────────────────────────────────────
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

  return saveAnalysis(plan, optionsHash);
}

/**
 * Selects + optionally refines segments, writing results to the DB incrementally.
 *
 * No-refine path  — selectSegments is synchronous; all segments written atomically
 *                   via upsertSegmentations (completed=1).
 *
 * Refine path     — clearSegmentations() first (wipes any stale partial rows),
 *                   each refined segment is inserted immediately via insertSegmentation
 *                   (completed=0) as onSegmentRefined fires, then
 *                   markSegmentationsComplete() flips the batch to completed=1.
 *                   If the process is interrupted mid-refine, completed=0 rows are
 *                   ignored by findSegmentations and cleared on the next refine pass.
 */
async function runSegmentation(
  videoId: string,
  optionsHash: string,
  chunkEvals: ChunkEvaluation[],
  microBlocks: Parameters<typeof refineRankedSegments>[1],
  selectOpts: Parameters<typeof selectSegments>[2],
  input: CreateAnalysisRequest,
  cfg: Config,
  model: ReturnType<typeof getModel>,
  maxParallel: number,
  requestId: string | undefined,
  callbacks: StreamCallbacks | undefined,
  signal: AbortSignal | undefined,
): Promise<RankedSegment[]> {
  const rankedSegments = selectSegments(chunkEvals, [], selectOpts);

  if (!input.options.refine || rankedSegments.length === 0) {
    // No-refine: synchronous result — write all at once (completed=1)
    upsertSegmentations(videoId, rankedSegments, optionsHash);
    return rankedSegments;
  }

  // Refine path: incremental per-segment writes
  clearSegmentations(videoId); // wipe stale partial rows from any prior aborted run

  const wrappedRefineCallbacks = {
    onSegmentStarted: (rank: number) => callbacks?.onSegmentStarted?.(rank),

    onSegmentTextDelta: (rank: number, text: string) => callbacks?.onSegmentTextDelta?.(rank, text),

    onSegmentRefined: (rank: number, segment: RankedSegment) => {
      // Persist immediately — completed=0 until markSegmentationsComplete()
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

  // All segments written — flip the batch to completed=1 so it becomes a cache hit
  markSegmentationsComplete(videoId);

  return refined;
}
