import { generateObject } from 'ai';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';
import { getModel } from '../../utils/modelFactory.js';
import { AnalyzedSegmentSchema } from '../../types/index.js';
import type { LLMChunk, AnalyzedSegment, ChunkEvaluation } from '../../types/index.js';

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
- "aha" moments or turning points`;

/**
 * Returns true if the error looks like an API rate-limit response.
 */
function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.toLowerCase().includes('rate limit') ||
    message.includes('429') ||
    message.toLowerCase().includes('too many requests')
  );
}

/**
 * Sleeps for `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds the chunk-specific user prompt for a single transcript chunk.
 * When a custom system prompt is in use, semantic scoring hints are omitted
 * so they don't conflict with the user's own instructions.
 */
function buildPrompt(chunk: LLMChunk, isCustomSystemPrompt: boolean): string {
  const semanticRules = isCustomSystemPrompt
    ? ''
    : `- Set interesting=true only if the segment is genuinely compelling
- Score 1-10 (7+ means worth clipping, 9-10 means viral potential)
`;

  return `Transcript Segment:
START: ${chunk.start}s
END: ${chunk.end}s

${chunk.text}

Rules for your response:
${semanticRules}
- clip_start and clip_end must be within [${chunk.start}, ${chunk.end}]
- clip_start must be less than clip_end`;
}

/**
 * Analyzes a single LLM chunk with exponential backoff + jitter on rate-limit errors.
 * Throws on non-retryable failures or when all retries are exhausted.
 */
async function analyzeChunk(chunk: LLMChunk): Promise<AnalyzedSegment> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.LLM_MAX_RETRIES; attempt++) {
    try {
      const { object } = await generateObject({
        model: getModel(),
        schema: AnalyzedSegmentSchema,
        system: config.LLM_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT,
        prompt: buildPrompt(chunk, !!config.LLM_SYSTEM_PROMPT),
        // Let our own retry loop handle rate limits; disable SDK-level retries
        maxRetries: 0,
      });
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

      // Non-retryable error or retries exhausted — re-throw for caller to handle
      throw err;
    }
  }

  throw lastError;
}

/**
 * Analyzes all LLM chunks in parallel using Promise.allSettled.
 * Returns a ChunkEvaluation for every chunk — successful ones include the full
 * LLM result; failed ones include the error message.
 */
export async function analyzeChunks(chunks: LLMChunk[]): Promise<ChunkEvaluation[]> {
  log.info(`Analyzing ${chunks.length} chunk${chunks.length !== 1 ? 's' : ''} in parallel...`);

  const results = await Promise.allSettled(chunks.map((chunk) => analyzeChunk(chunk)));

  let succeeded = 0;
  const evaluations: ChunkEvaluation[] = results.map((result, i) => {
    const chunk = chunks[i];
    if (result.status === 'fulfilled') {
      succeeded++;
      const seg: AnalyzedSegment = result.value;
      return {
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
    } else {
      const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
      log.warn(`[chunk ${i}] LLM analysis skipped: ${error}`);
      return {
        status: 'failed' as const,
        chunk_index: i,
        chunk_start: chunk.start,
        chunk_end: chunk.end,
        error,
      };
    }
  });

  log.info(`Analysis complete: ${succeeded}/${chunks.length} chunks succeeded`);
  return evaluations;
}
