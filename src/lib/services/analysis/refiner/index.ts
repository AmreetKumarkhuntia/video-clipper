import { streamText, tool, zodSchema } from 'ai';
import pLimit from 'p-limit';
import { z } from 'zod';
import { log } from '@lib/utils/logger.js';
import type { CacheBackend } from '@lib/utils/cacheBackend.js';
import type { RankedSegment, MicroBlock, StreamCallbacks } from '../types.js';
import type { LanguageModel } from 'ai';

const CONTEXT_PADDING_SEC = 30;

const RefinedBoundariesSchema = z.object({
  clip_start: z.number().describe('Refined clip start time in seconds'),
  clip_end: z.number().describe('Refined clip end time in seconds'),
});

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
- Only make small adjustments (seconds, not minutes)

After analyzing, call the report_refined_boundaries tool with your refined clip boundaries.`;
}

export interface RefineSegmentsOpts {
  maxRetries: number;
  model: LanguageModel;
  callbacks?: Pick<StreamCallbacks, 'onSegmentTextDelta' | 'onSegmentRefined'>;
}

function createReportRefinedBoundariesTool() {
  return tool({
    description:
      'Report the refined clip boundaries. Call this tool once you have determined the optimal start and end times.',
    inputSchema: zodSchema(
      z.object({
        clip_start: z.number().describe('Refined clip start time in seconds'),
        clip_end: z.number().describe('Refined clip end time in seconds'),
      }),
    ),
  });
}

async function refineSegment(
  segment: RankedSegment,
  allBlocks: MicroBlock[],
  cache: CacheBackend,
  noCache: boolean,
  opts: RefineSegmentsOpts,
): Promise<RankedSegment> {
  if (!noCache) {
    const cached = await cache.readSegmentRefinement(segment.start, segment.end, segment.reason);
    if (cached) {
      log.info(`[segment] cache hit (rank=${segment.rank})`);
      const refined = { ...segment, start: cached.refined_start, end: cached.refined_end };
      opts.callbacks?.onSegmentRefined?.(segment.rank, refined);
      return refined;
    }
  }

  const { text, windowStart, windowEnd } = buildContextText(segment, allBlocks);

  const result = streamText({
    model: opts.model,
    tools: { report_refined_boundaries: createReportRefinedBoundariesTool() },
    toolChoice: 'required',
    prompt: buildPrompt(segment, text, windowStart, windowEnd),
    maxRetries: opts.maxRetries,
  });

  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      opts.callbacks?.onSegmentTextDelta?.(segment.rank, part.text);
    }
  }

  const toolCalls = await result.staticToolCalls;

  if (
    !toolCalls ||
    toolCalls.length === 0 ||
    toolCalls[0].toolName !== 'report_refined_boundaries'
  ) {
    throw new Error('LLM did not call report_refined_boundaries tool');
  }

  const object = RefinedBoundariesSchema.parse(toolCalls[0].input);

  const refinedStart = Math.max(windowStart, Math.min(object.clip_start, object.clip_end - 1));
  const refinedEnd = Math.min(windowEnd, Math.max(object.clip_end, object.clip_start + 1));

  if (!noCache) {
    await cache.writeSegmentRefinement(segment.start, segment.end, segment.reason, {
      refined_start: refinedStart,
      refined_end: refinedEnd,
    });
  }

  const refined = { ...segment, start: refinedStart, end: refinedEnd };
  opts.callbacks?.onSegmentRefined?.(segment.rank, refined);
  return refined;
}

export async function refineSegments(
  segments: RankedSegment[],
  allBlocks: MicroBlock[],
  concurrency: number,
  cache: CacheBackend,
  noCache: boolean,
  opts: RefineSegmentsOpts,
): Promise<RankedSegment[]> {
  log.info(
    `Refining boundaries for ${segments.length} segment${segments.length !== 1 ? 's' : ''} (max ${concurrency} parallel)...`,
  );

  const limit = pLimit(concurrency);
  const results = await Promise.allSettled(
    segments.map((segment) => limit(() => refineSegment(segment, allBlocks, cache, noCache, opts))),
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
