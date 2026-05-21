import pLimit from 'p-limit';
import { z } from 'zod';
import { defineTool } from '@lib/services/modelFactory/index.js';
import { log } from '@lib/utils/logger.js';
import { AnalyzedSegmentSchema } from '@lib/types/segment.js';
import type {
  LLMChunk,
  TranscriptLine,
  AnalyzedSegment,
  ChunkEvaluation,
  AudioEvent,
  StreamCallbacks,
} from '@lib/types/index.js';
import type { AnalyzeChunksOpts } from '@lib/types/analyzer.js';

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

function toSuccessEvaluation(
  chunk: LLMChunk,
  chunkIndex: number,
  segment: AnalyzedSegment,
): Extract<ChunkEvaluation, { status: 'success' }> {
  return {
    status: 'success',
    chunk_index: chunkIndex,
    chunk_start: chunk.start,
    chunk_end: chunk.end,
    interesting: segment.interesting,
    score: segment.score,
    reason: segment.reason,
    clip_start: segment.clip_start,
    clip_end: segment.clip_end,
  };
}

function toFailedEvaluation(
  chunk: LLMChunk,
  chunkIndex: number,
  error: unknown,
): Extract<ChunkEvaluation, { status: 'failed' }> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    status: 'failed',
    chunk_index: chunkIndex,
    chunk_start: chunk.start,
    chunk_end: chunk.end,
    error: errorMessage,
  };
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
  return defineTool({
    description:
      'Report the analysis result for this transcript segment. Call this tool once you have evaluated the segment.',
    inputSchema: z.object({
      interesting: z.boolean().describe('Whether this segment contains an interesting moment'),
      score: z.number().min(1).max(10).describe('Interest score from 1-10'),
      reason: z.string().describe('Brief explanation of why this segment is or is not interesting'),
      clip_start: z.number().describe('Suggested clip start time in seconds'),
      clip_end: z.number().describe('Suggested clip end time in seconds'),
    }),
  });
}

async function analyzeChunk(
  chunk: LLMChunk,
  chunkLines: TranscriptLine[],
  chunkAudioEvents: AudioEvent[],
  chunkIndex: number,
  opts: AnalyzeChunksOpts,
): Promise<AnalyzedSegment> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const prompt = buildPrompt(
        chunk,
        chunkLines,
        chunkAudioEvents,
        opts.systemPrompt !== DEFAULT_SYSTEM_PROMPT,
      );

      const result = opts.model.streamText({
        tools: { report_analysis: createReportAnalysisTool() },
        toolChoice: 'required',
        system: opts.systemPrompt,
        prompt: prompt,
        maxRetries: 0,
        abortSignal: opts.signal,
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
        'analyzeChunk',
        `Chunk ${chunkIndex} analysis complete: interesting=${object.interesting}, score=${object.score}, reason=${object.reason}`,
        opts.requestId,
      );
      return object;
    } catch (err) {
      lastError = err;

      if (isRateLimitError(err) && attempt < opts.maxRetries) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt) + Math.random() * BACKOFF_JITTER_MS;
        log.warn(
          'analyzeChunk',
          `[chunk] Rate limit hit (attempt ${attempt + 1}/${opts.maxRetries + 1}). ` +
            `Retrying in ${Math.round(delay)}ms...`,
          opts.requestId,
        );
        await sleep(delay);
        continue;
      } else {
        log.error(
          'analyzeChunk',
          `[chunk] Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
          opts.requestId,
        );
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
  opts: AnalyzeChunksOpts,
): Promise<ChunkEvaluation[]> {
  const done = log.fnCalled('analyzeChunks', opts.requestId, {
    chunks: chunks.length,
    concurrency,
  });

  const limit = pLimit(concurrency);
  const evaluations = await Promise.all(
    chunks.map((chunk, i) =>
      limit(async () => {
        const chunkLines = lines.filter((l) => l.start >= chunk.start && l.start < chunk.end);
        const chunkAudioEvents = audioEvents.filter(
          (e) => e.time >= chunk.start && e.time < chunk.end,
        );
        opts.callbacks?.onChunkStarted?.(i);

        try {
          const seg = await analyzeChunk(chunk, chunkLines, chunkAudioEvents, i, opts);
          const evaluation = toSuccessEvaluation(chunk, i, seg);
          opts.callbacks?.onChunkAnalyzed?.(i, evaluation);
          return evaluation;
        } catch (error) {
          const failedEvaluation = toFailedEvaluation(chunk, i, error);
          log.warn(
            'analyzeChunks',
            `[chunk ${i}] LLM analysis skipped: ${failedEvaluation.error}`,
            opts.requestId,
          );
          opts.callbacks?.onChunkAnalyzed?.(i, failedEvaluation);
          return failedEvaluation;
        }
      }),
    ),
  );

  const succeeded = evaluations.filter((evaluation) => evaluation.status === 'success').length;

  log.info(
    'analyzeChunks',
    `Analysis complete: ${succeeded}/${chunks.length} chunks succeeded`,
    opts.requestId,
  );
  done({ succeeded, total: chunks.length });
  return evaluations;
}
