import { config } from '@lib/config/index.js';
import { Cache } from '@lib/utils/cache.js';
import { createCacheBackend } from '@lib/utils/cacheFactory.js';
import { getModel } from '@lib/utils/modelFactory.js';
import { analyzeSegments, refineRankedSegments } from '@lib/pipeline/stages/segmentAnalyzer.js';
import { selectSegments } from '@lib/pipeline/stages/segmentSelector.js';
import { createArtifactId, saveAnalysis } from '@app/web/lib/services/artifacts/artifactStore.js';
import { ClipPlanSchema } from '@app/web/types/analysis.js';
import type { ClipCandidate, ClipPlan, CreateAnalysisRequest } from '@app/web/types/analysis.js';
import type { RankedSegment, TranscriptLine, StreamCallbacks } from '@lib/types/index.js';
import type { YtDlpCookies } from '@lib/services/video/source/youtube/metadata.js';
import type { TranscriptChainConfig } from '@lib/services/audio/transcriber/index.js';

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

export async function analyzeTranscriptForWeb(
  input: CreateAnalysisRequest,
  callbacks?: StreamCallbacks,
): Promise<ClipPlan> {
  const backend = await createCacheBackend(config, input.options.noCache);
  const cache = new Cache(backend);

  const cookies: YtDlpCookies = {
    cookiesFromBrowser: config.YT_DLP_COOKIES_FROM_BROWSER,
    cookiesFile: config.YT_DLP_COOKIES_FILE,
  };

  const transcriptChainConfig: TranscriptChainConfig = {
    ...cookies,
    whisperModel: config.AUDIO_WHISPER_MODEL,
  };

  const model = getModel(config.LLM_PROVIDER, config.LLM_MODEL, {
    ZAI_API_KEY: config.ZAI_API_KEY,
    OPENROUTER_API_KEY: config.OPENROUTER_API_KEY,
    CUSTOM_OPENAI_BASE_URL: config.CUSTOM_OPENAI_BASE_URL,
    CUSTOM_OPENAI_API_KEY: config.CUSTOM_OPENAI_API_KEY,
  });

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
        transcriptProvider: config.TRANSCRIPT_PROVIDER,
        transcriptChainConfig,
        microBlockSec: config.MICRO_BLOCK_SEC,
        chunkLengthSec: config.CHUNK_LENGTH_SEC,
        chunkOverlapSec: config.CHUNK_OVERLAP_SEC,
        model,
        maxRetries: config.LLM_MAX_RETRIES,
        systemPrompt: config.LLM_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT,
        llmModel: config.LLM_MODEL,
        callbacks,
      },
    );

    const rankedSegments = selectSegments(chunkEvals, [], {
      threshold: input.options.threshold ?? config.SCORE_THRESHOLD,
      topN: input.options.topN ?? config.TOP_N_SEGMENTS,
      boostWindow: config.AUDIO_LLM_BOOST_WINDOW,
      scoreBoost: config.AUDIO_LLM_SCORE_BOOST,
      preRoll: config.AUDIO_CLIP_PRE_ROLL,
      postRoll: config.AUDIO_CLIP_POST_ROLL,
    });

    const finalSegments =
      input.options.refine && rankedSegments.length > 0
        ? await refineRankedSegments(rankedSegments, microBlocks, cache, {
            maxParallel: input.options.maxParallel ?? config.LLM_CONCURRENCY,
            noCache: input.options.noCache,
            maxRetries: config.LLM_MAX_RETRIES,
            model,
            callbacks,
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

    return saveAnalysis(plan, config.OUTPUT_DIR);
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
