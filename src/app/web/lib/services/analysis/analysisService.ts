import { Cache, createCacheBackend } from '@lib/services/cache/index.js';
import { getModel } from '@lib/utils/modelFactory.js';
import { analyzeSegments, refineRankedSegments } from '@lib/pipeline/stages/segmentAnalyzer.js';
import { selectSegments } from '@lib/pipeline/stages/segmentSelector.js';
import { createArtifactId, saveAnalysis } from '@app/web/lib/services/artifacts/artifactStore.js';
import { ClipPlanSchema } from '@app/web/types/analysis.js';
import type { ClipCandidate, ClipPlan, CreateAnalysisRequest } from '@app/web/types/analysis.js';
import type { RankedSegment, TranscriptLine, StreamCallbacks } from '@lib/types/index.js';
import type { YtDlpCookies } from '@lib/services/video/source/youtube/metadata.js';
import type { TranscriptChainConfig } from '@lib/services/audio/transcriber/index.js';
import type { Config } from '@lib/types/config.js';

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

const DEFAULT_WEB_LLM_CONCURRENCY = 3;

export async function analyzeTranscriptForWeb(
  input: CreateAnalysisRequest,
  cfg: Config,
  callbacks?: StreamCallbacks,
  requestId?: string,
  signal?: AbortSignal,
): Promise<ClipPlan> {
  const backend = await createCacheBackend(cfg, input.options.noCache);
  const cache = new Cache(backend, videoIdFrom(input));

  const cookies: YtDlpCookies = {
    cookiesFromBrowser: cfg.YT_DLP_COOKIES_FROM_BROWSER,
    cookiesFile: cfg.YT_DLP_COOKIES_FILE,
    quiet: cfg.YT_DLP_QUIET,
    retryCount: cfg.YT_DLP_RETRY_COUNT,
  };

  const transcriptChainConfig: TranscriptChainConfig = {
    ...cookies,
    whisperModel: cfg.AUDIO_WHISPER_MODEL,
  };

  const model = getModel(cfg.LLM_PROVIDER, cfg.LLM_MODEL, {
    ZAI_API_KEY: cfg.ZAI_API_KEY,
    OPENROUTER_API_KEY: cfg.OPENROUTER_API_KEY,
    CUSTOM_OPENAI_BASE_URL: cfg.CUSTOM_OPENAI_BASE_URL,
    CUSTOM_OPENAI_API_KEY: cfg.CUSTOM_OPENAI_API_KEY,
  });

  try {
    const basePrompt = cfg.LLM_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT;
    const systemPrompt = cfg.LLM_SYSTEM_PROMPT
      ? basePrompt
      : buildAnalysisSystemPrompt(basePrompt, input.title, input.channelTitle, input.description);

    const { lines, microBlocks, chunkEvals } = await analyzeSegments(
      videoIdFrom(input),
      null,
      [],
      cache,
      {
        maxChunks: input.options.maxChunks ?? cfg.MAX_CHUNKS,
        maxParallel: input.options.maxParallel ?? DEFAULT_WEB_LLM_CONCURRENCY,
        noCache: input.options.noCache,
        requestId,
        transcriptProvider: cfg.TRANSCRIPT_PROVIDER,
        transcriptChainConfig,
        microBlockSec: cfg.MICRO_BLOCK_SEC,
        chunkLengthSec: cfg.CHUNK_LENGTH_SEC,
        chunkOverlapSec: cfg.CHUNK_OVERLAP_SEC,
        model,
        maxRetries: cfg.LLM_MAX_RETRIES,
        systemPrompt,
        llmModel: cfg.LLM_MODEL,
        videoTitle: input.title,
        callbacks,
        signal,
      },
    );

    const rankedSegments = selectSegments(chunkEvals, [], {
      threshold: input.options.threshold ?? cfg.SCORE_THRESHOLD,
      topN: input.options.topN ?? cfg.TOP_N_SEGMENTS,
      boostWindow: cfg.AUDIO_LLM_BOOST_WINDOW,
      scoreBoost: cfg.AUDIO_LLM_SCORE_BOOST,
      preRoll: cfg.AUDIO_CLIP_PRE_ROLL,
      postRoll: cfg.AUDIO_CLIP_POST_ROLL,
    });

    const finalSegments =
      input.options.refine && rankedSegments.length > 0
        ? await refineRankedSegments(rankedSegments, microBlocks, cache, {
            maxParallel: input.options.maxParallel ?? DEFAULT_WEB_LLM_CONCURRENCY,
            noCache: input.options.noCache,
            maxRetries: cfg.LLM_MAX_RETRIES,
            model,
            requestId,
            videoTitle: input.title,
            callbacks,
            signal,
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

    return saveAnalysis(plan, cfg.OUTPUT_DIR);
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
