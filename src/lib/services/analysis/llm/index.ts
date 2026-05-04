import { streamText, tool, zodSchema } from 'ai';
import pLimit from 'p-limit';
import { z } from 'zod';
import { log } from '@lib/utils/logger.js';
import { formatSeconds } from '@lib/utils/format.js';
import { AnalyzedSegmentSchema } from '../types.js';
import type {
  LLMChunk,
  TranscriptLine,
  AnalyzedSegment,
  ChunkEvaluation,
  AudioEvent,
  StreamCallbacks,
} from '../types.js';
import type { CacheBackend } from '@lib/utils/cacheBackend.js';
import type { LanguageModel } from 'ai';

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
they indicate high-action or high-energy moments that are often clip-worthy.

After analyzing the segment, call the report_analysis tool with your findings.`;

export interface AnalyzeChunksOpts {
  maxRetries: number;
  systemPrompt: string;
  model: LanguageModel;
  callbacks?: Pick<StreamCallbacks, 'onChunkTextDelta' | 'onChunkAnalyzed'>;
}

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

function createReportAnalysisTool() {
  return tool({
    description:
      'Report the analysis result for this transcript segment. Call this tool once you have evaluated the segment.',
    inputSchema: zodSchema(
      z.object({
        interesting: z.boolean().describe('Whether this segment contains an interesting moment'),
        score: z.number().min(1).max(10).describe('Interest score from 1-10'),
        reason: z
          .string()
          .describe('Brief explanation of why this segment is or is not interesting'),
        clip_start: z.number().describe('Suggested clip start time in seconds'),
        clip_end: z.number().describe('Suggested clip end time in seconds'),
      }),
    ),
  });
}

async function analyzeChunk(
  chunk: LLMChunk,
  chunkLines: TranscriptLine[],
  chunkAudioEvents: AudioEvent[],
  cache: CacheBackend,
  noCache: boolean,
  chunkIndex: number,
  opts: AnalyzeChunksOpts,
): Promise<AnalyzedSegment> {
  if (!noCache) {
    const cached = await cache.readChunk(chunk, chunkAudioEvents);
    if (cached && cached.status === 'success') {
      log.info(`[chunk] cache hit (${formatSeconds(chunk.start)}–${formatSeconds(chunk.end)})`);
      const result: AnalyzedSegment = {
        interesting: cached.interesting,
        score: cached.score,
        reason: cached.reason,
        clip_start: cached.clip_start,
        clip_end: cached.clip_end,
      };
      return result;
    }
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const prompt = buildPrompt(
        chunk,
        chunkLines,
        chunkAudioEvents,
        opts.systemPrompt !== DEFAULT_SYSTEM_PROMPT,
      );

      const result = streamText({
        model: opts.model,
        tools: { report_analysis: createReportAnalysisTool() },
        toolChoice: 'required',
        system: opts.systemPrompt,
        prompt: prompt,
        maxRetries: 0,
      });

      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          opts.callbacks?.onChunkTextDelta?.(chunkIndex, part.text);
        }
      }

      const toolCalls = await result.staticToolCalls;

      if (!toolCalls || toolCalls.length === 0 || toolCalls[0].toolName !== 'report_analysis') {
        throw new Error('LLM did not call report_analysis tool');
      }

      const object = AnalyzedSegmentSchema.parse(toolCalls[0].input);

      log.info(
        `Chunk ${chunkIndex} analysis complete: interesting=${object.interesting}, score=${object.score}, reason=${object.reason}`,
      );
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
        await cache.writeChunk(chunk, evaluation, chunkAudioEvents);
      }
      return object;
    } catch (err) {
      lastError = err;

      if (isRateLimitError(err) && attempt < opts.maxRetries) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt) + Math.random() * BACKOFF_JITTER_MS;
        log.warn(
          `[chunk] Rate limit hit (attempt ${attempt + 1}/${opts.maxRetries + 1}). ` +
            `Retrying in ${Math.round(delay)}ms...`,
        );
        await sleep(delay);
        continue;
      } else {
        log.error(`[chunk] Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      throw err;
    }
  }

  throw lastError;
}

export async function analyzeChunks(
  chunks: LLMChunk[],
  lines: TranscriptLine[],
  audioEvents: AudioEvent[],
  concurrency: number,
  cache: CacheBackend,
  noCache: boolean,
  opts: AnalyzeChunksOpts,
): Promise<ChunkEvaluation[]> {
  const done = log.fnCalled('analyzeChunks', { chunks: chunks.length, concurrency });

  const limit = pLimit(concurrency);
  const results = await Promise.allSettled(
    chunks.map((chunk, i) => {
      const chunkLines = lines.filter((l) => l.start >= chunk.start && l.start < chunk.end);
      const chunkAudioEvents = audioEvents.filter(
        (e) => e.time >= chunk.start && e.time < chunk.end,
      );
      return limit(() =>
        analyzeChunk(chunk, chunkLines, chunkAudioEvents, cache, noCache, i, opts),
      );
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
        opts.callbacks?.onChunkAnalyzed?.(i, evaluation);
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
  done({ succeeded, total: chunks.length });
  return evaluations;
}
