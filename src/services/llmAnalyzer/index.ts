import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';
import { AnalyzedSegmentSchema } from '../../types/index.js';
import type { LLMChunk, AnalyzedSegment } from '../../types/index.js';

const BACKOFF_BASE_MS = 1000;
const BACKOFF_JITTER_MS = 500;

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
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Builds the LLM prompt for a single transcript chunk.
 */
function buildPrompt(chunk: LLMChunk): string {
  return `You are an expert video editor analyzing a YouTube transcript segment.

Identify if this segment contains a potentially interesting moment worth clipping.

Interesting moments include:
- surprising insights or revelations
- strong or controversial opinions
- humor or entertaining storytelling
- emotional moments
- key explanations of important concepts
- "aha" moments or turning points

Transcript Segment:
START: ${chunk.start}s
END: ${chunk.end}s

${chunk.text}

Rules for your response:
- Set interesting=true only if the segment is genuinely compelling
- Score 1-10 (7+ means worth clipping, 9-10 means viral potential)
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
        model: openai(config.LLM_MODEL),
        schema: AnalyzedSegmentSchema,
        prompt: buildPrompt(chunk),
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
          `Retrying in ${Math.round(delay)}ms...`
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
 * Failed chunks are logged and skipped — never crashes the pipeline.
 *
 * @returns AnalyzedSegment[] from successfully analyzed chunks only
 */
export async function analyzeChunks(chunks: LLMChunk[]): Promise<AnalyzedSegment[]> {
  log.info(`Analyzing ${chunks.length} chunk${chunks.length !== 1 ? 's' : ''} in parallel...`);

  const results = await Promise.allSettled(chunks.map(chunk => analyzeChunk(chunk)));

  const segments: AnalyzedSegment[] = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      segments.push(result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      log.warn(`[chunk ${i}] LLM analysis skipped: ${reason}`);
    }
  });

  log.info(`Analysis complete: ${segments.length}/${chunks.length} chunks succeeded`);
  return segments;
}
