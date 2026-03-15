import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';
import { AnalyzedSegmentSchema } from '../../types/index.js';
import type { LLMChunk, AnalyzedSegment } from '../../types/index.js';

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
 * Analyzes a single LLM chunk and returns an AnalyzedSegment.
 * Throws on LLM failure — caller handles via Promise.allSettled.
 */
async function analyzeChunk(chunk: LLMChunk): Promise<AnalyzedSegment> {
  const { object } = await generateObject({
    model: openai(config.LLM_MODEL),
    schema: AnalyzedSegmentSchema,
    prompt: buildPrompt(chunk),
    maxRetries: config.LLM_MAX_RETRIES,
  });
  return object;
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
