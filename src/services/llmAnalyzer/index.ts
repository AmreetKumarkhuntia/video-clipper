import { generateObject } from 'ai';
import pLimit from 'p-limit';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';
import { formatSeconds } from '../../utils/format.js';
import { getModel } from '../../utils/modelFactory.js';
import { Cache } from '../../utils/cache.js';
import { AnalyzedSegmentSchema } from '../../types/index.js';
import type {
  LLMChunk,
  TranscriptLine,
  AnalyzedSegment,
  ChunkEvaluation,
  AudioEvent,
} from '../../types/index.js';

const BACKOFF_BASE_MS = 1000;
const BACKOFF_JITTER_MS = 500;

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
they indicate high-action or high-energy moments that are often clip-worthy.`;

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.toLowerCase().includes('rate limit') ||
    message.includes('429') ||
    message.toLowerCase().includes('too many requests')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds the user prompt for a single transcript chunk.
 * Semantic scoring hints are omitted when a custom system prompt is in use.
 */
function buildPrompt(
  chunk: LLMChunk,
  chunkLines: TranscriptLine[],
  chunkAudioEvents: AudioEvent[],
  isCustomSystemPrompt: boolean,
): string {
  const semanticRules = isCustomSystemPrompt
    ? ''
    : `- Set interesting=true only if the segment is genuinely compelling
- Score 1-10 (7+ means worth clipping, 9-10 means viral potential)
`;

  const transcriptBody =
    chunkLines.length > 0
      ? chunkLines.map((l) => `[${l.start.toFixed(1)}s] ${l.text}`).join('\n')
      : chunk.text;

  const audioSection =
    chunkAudioEvents.length > 0
      ? `\nAudio Events Detected (within this segment):\n${chunkAudioEvents
          .slice()
          .sort((a, b) => a.time - b.time)
          .map(
            (e) => `  [${e.time.toFixed(1)}s] ${e.event} (confidence: ${e.confidence.toFixed(2)})`,
          )
          .join('\n')}\n`
      : '';

  return `Transcript Segment:
START: ${chunk.start}s
END: ${chunk.end}s

${transcriptBody}
${audioSection}
Rules for your response:
${semanticRules}- clip_start and clip_end must be within [${chunk.start}, ${chunk.end}]
- clip_start must be less than clip_end`;
}

/**
 * Analyzes a single LLM chunk with exponential backoff + jitter on rate-limit errors.
 */
async function analyzeChunk(
  chunk: LLMChunk,
  chunkLines: TranscriptLine[],
  chunkAudioEvents: AudioEvent[],
  noCache: boolean,
  chunkIndex: number,
): Promise<AnalyzedSegment> {
  if (!noCache) {
    const cache = new Cache(config.CACHE_DIR);
    const cached = await cache.readChunk(chunk, chunkAudioEvents);
    if (cached && cached.status === 'success') {
      log.info(`[chunk] cache hit (${formatSeconds(chunk.start)}–${formatSeconds(chunk.end)})`);
      return {
        interesting: cached.interesting,
        score: cached.score,
        reason: cached.reason,
        clip_start: cached.clip_start,
        clip_end: cached.clip_end,
      };
    }
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= config.LLM_MAX_RETRIES; attempt++) {
    try {
      const { object } = await generateObject({
        model: getModel(),
        schema: AnalyzedSegmentSchema,
        system: config.LLM_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT,
        prompt: buildPrompt(chunk, chunkLines, chunkAudioEvents, !!config.LLM_SYSTEM_PROMPT),
        maxRetries: 0,
      });
      if (!noCache) {
        const evaluation: ChunkEvaluation = {
          status: 'success' as const,
          chunk_index: chunkIndex,
          chunk_start: chunk.start,
          chunk_end: chunk.end,
          interesting: object.interesting,
          score: object.score,
          reason: object.reason,
          clip_start: object.clip_start,
          clip_end: object.clip_end,
        };
        await new Cache(config.CACHE_DIR).writeChunk(chunk, evaluation, chunkAudioEvents);
      }
      return object;
    } catch (err) {
      lastError = err;

      if (isRateLimitError(err) && attempt < config.LLM_MAX_RETRIES) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt) + Math.random() * BACKOFF_JITTER_MS;
        log.warn(
          `[chunk] Rate limit hit (attempt ${attempt + 1}/${config.LLM_MAX_RETRIES + 1}). ` +
            `Retrying in ${Math.round(delay)}ms...`,
        );
        await sleep(delay);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

/**
 * Analyzes all LLM chunks via Promise.allSettled — one failure never aborts the rest.
 * Each chunk receives only the transcript lines and audio events within its window.
 * Pass noCache=true to bypass the on-disk chunk cache.
 */
export async function analyzeChunks(
  chunks: LLMChunk[],
  lines: TranscriptLine[],
  audioEvents: AudioEvent[],
  concurrency: number,
  noCache = false,
): Promise<ChunkEvaluation[]> {
  log.info(
    `Analyzing ${chunks.length} chunk${chunks.length !== 1 ? 's' : ''} (max ${concurrency} parallel)...`,
  );

  const limit = pLimit(concurrency);
  const results = await Promise.allSettled(
    chunks.map((chunk, i) => {
      const chunkLines = lines.filter((l) => l.start >= chunk.start && l.start < chunk.end);
      const chunkAudioEvents = audioEvents.filter(
        (e) => e.time >= chunk.start && e.time < chunk.end,
      );
      return limit(() => analyzeChunk(chunk, chunkLines, chunkAudioEvents, noCache, i));
    }),
  );

  let succeeded = 0;
  const evaluations: ChunkEvaluation[] = await Promise.all(
    results.map(async (result, i) => {
      const chunk = chunks[i];
      if (result.status === 'fulfilled') {
        succeeded++;
        const seg: AnalyzedSegment = result.value;
        const evaluation: ChunkEvaluation = {
          status: 'success' as const,
          chunk_index: i,
          chunk_start: chunk.start,
          chunk_end: chunk.end,
          interesting: seg.interesting,
          score: seg.score,
          reason: seg.reason,
          clip_start: seg.clip_start,
          clip_end: seg.clip_end,
        };
        return evaluation;
      } else {
        const error =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        log.warn(`[chunk ${i}] LLM analysis skipped: ${error}`);
        return {
          status: 'failed' as const,
          chunk_index: i,
          chunk_start: chunk.start,
          chunk_end: chunk.end,
          error,
        };
      }
    }),
  );

  log.info(`Analysis complete: ${succeeded}/${chunks.length} chunks succeeded`);
  return evaluations;
}
