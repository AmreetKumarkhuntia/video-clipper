import { generateObject } from 'ai';
import pLimit from 'p-limit';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';
import { getModel } from '../../utils/modelFactory.js';
import { Cache } from '../../utils/cache.js';
import type { RankedSegment, MicroBlock } from '../../types/index.js';

const CONTEXT_PADDING_SEC = 30;

const RefinedBoundariesSchema = z.object({
  clip_start: z.number().describe('Refined clip start time in seconds'),
  clip_end: z.number().describe('Refined clip end time in seconds'),
});

/**
 * Extracts the micro-block text that falls within a context window
 * around the segment, padded by CONTEXT_PADDING_SEC on each side.
 */
function buildContextText(
  segment: RankedSegment,
  allBlocks: MicroBlock[],
): { text: string; windowStart: number; windowEnd: number } {
  const windowStart = Math.max(0, segment.start - CONTEXT_PADDING_SEC);
  const windowEnd = segment.end + CONTEXT_PADDING_SEC;

  const contextBlocks = allBlocks.filter((b) => b.end > windowStart && b.start < windowEnd);

  return {
    text: contextBlocks.map((b) => b.text).join(' '),
    windowStart,
    windowEnd,
  };
}

/**
 * Builds the refinement prompt for a single ranked segment.
 */
function buildPrompt(
  segment: RankedSegment,
  contextText: string,
  windowStart: number,
  windowEnd: number,
): string {
  return `You are a video editor refining clip boundaries.

Goal: tighten the clip so it starts just before the interesting moment begins
and ends just after it concludes, giving it a natural entry and exit point.
Avoid cutting in the middle of a sentence.

Current clip:
START: ${segment.start}s
END: ${segment.end}s
REASON: ${segment.reason}

Broader transcript context (${windowStart}s – ${windowEnd}s):
${contextText}

Rules:
- clip_start must be >= ${windowStart}
- clip_end must be <= ${windowEnd}
- clip_start must be less than clip_end
- Only make small adjustments (seconds, not minutes)`;
}

/**
 * Refines the boundaries of a single ranked segment via a second LLM pass.
 * Returns the segment with updated start/end if successful.
 * Falls back to the original boundaries on failure.
 */
async function refineSegment(
  segment: RankedSegment,
  allBlocks: MicroBlock[],
  noCache: boolean,
): Promise<RankedSegment> {
  const cache = new Cache(config.CACHE_DIR);
  if (!noCache) {
    const cached = await cache.readSegmentRefinement(segment.start, segment.end, segment.reason);
    if (cached) {
      log.info(`[segment] cache hit (rank=${segment.rank})`);
      return { ...segment, start: cached.refined_start, end: cached.refined_end };
    }
  }

  const { text, windowStart, windowEnd } = buildContextText(segment, allBlocks);

  const { object } = await generateObject({
    model: getModel(),
    schema: RefinedBoundariesSchema,
    prompt: buildPrompt(segment, text, windowStart, windowEnd),
    maxRetries: config.LLM_MAX_RETRIES,
  });

  // Clamp to the context window to ensure LLM doesn't hallucinate out-of-range values
  const refinedStart = Math.max(windowStart, Math.min(object.clip_start, object.clip_end - 1));
  const refinedEnd = Math.min(windowEnd, Math.max(object.clip_end, object.clip_start + 1));

  if (!noCache) {
    await cache.writeSegmentRefinement(segment.start, segment.end, segment.reason, {
      refined_start: refinedStart,
      refined_end: refinedEnd,
    });
  }

  return { ...segment, start: refinedStart, end: refinedEnd };
}

/**
 * Runs a second LLM pass on all ranked segments in parallel to tighten clip boundaries.
 * Segments that fail refinement retain their original boundaries.
 *
 * @returns RankedSegment[] with refined (or original) start/end values
 */
export async function refineSegments(
  segments: RankedSegment[],
  allBlocks: MicroBlock[],
  concurrency: number,
  noCache = false,
): Promise<RankedSegment[]> {
  log.info(
    `Refining boundaries for ${segments.length} segment${segments.length !== 1 ? 's' : ''} (max ${concurrency} parallel)...`,
  );

  const limit = pLimit(concurrency);
  const results = await Promise.allSettled(
    segments.map((segment) => limit(() => refineSegment(segment, allBlocks, noCache))),
  );

  const refined = results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    log.warn(`[segment rank=${segments[i].rank}] refinement skipped: ${reason}`);
    return segments[i];
  });

  log.info(`Refinement complete`);
  return refined;
}
