import { analyzeChunks } from '../../services/llmAnalyzer/index.js';
import { refineSegments } from '../../services/clipRefiner/index.js';
import { log } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import type { Cache } from '../../utils/cache.js';
import type {
  LLMChunk,
  TranscriptLine,
  AudioEvent,
  MicroBlock,
  RankedSegment,
  SegmentAnalyzerOpts,
  SegmentAnalyzerResult,
} from '../../types/index.js';

export type { SegmentAnalyzerOpts, SegmentAnalyzerResult };

/**
 * Stage 4a — Segment Analyzer (LLM pass 1)
 *
 * Runs LLM analysis over all transcript chunks in parallel, respecting the
 * optional `maxChunks` cap. Audio events and transcript lines within each
 * chunk's window are forwarded to the LLM prompt for full context scoring.
 *
 * Returns raw ChunkEvaluation results — ranking and merging with audio signals
 * happen in segmentSelector, and the second LLM refinement pass happens in
 * refineRankedSegments (after ranking).
 */
export async function analyzeSegments(
  chunks: LLMChunk[],
  lines: TranscriptLine[],
  audioEvents: AudioEvent[],
  cache: Cache,
  opts: SegmentAnalyzerOpts,
): Promise<SegmentAnalyzerResult> {
  const chunkLimit = opts.maxChunks ?? config.MAX_CHUNKS;
  const chunksToAnalyze = chunkLimit !== undefined ? chunks.slice(0, chunkLimit) : chunks;

  if (chunkLimit !== undefined) {
    log.info(
      `Limiting evaluation to ${chunksToAnalyze.length} of ${chunks.length} chunks (--max-chunks ${chunkLimit})`,
    );
  }

  log.info(
    `Analyzing chunks with ${config.LLM_MODEL} (${chunksToAnalyze.length} chunks, max ${opts.maxParallel} parallel)...`,
  );

  const chunkEvals = await analyzeChunks(
    chunksToAnalyze,
    lines,
    audioEvents,
    opts.maxParallel,
    opts.noCache,
  );

  const succeededCount = chunkEvals.filter((e) => e.status === 'success').length;
  if (succeededCount === 0) {
    throw new Error('All chunks failed LLM analysis. Check your API key and model config.');
  }

  return { chunkEvals };
}

/**
 * Stage 4b — Segment Refiner (LLM pass 2)
 *
 * Runs a second LLM pass on already-ranked segments to tighten clip
 * boundaries. Separated from `analyzeSegments` because ranking (stage 5)
 * must happen between the two passes.
 */
export async function refineRankedSegments(
  rankedSegments: RankedSegment[],
  microBlocks: MicroBlock[],
  cache: Cache,
  opts: Pick<SegmentAnalyzerOpts, 'maxParallel' | 'noCache'>,
): Promise<RankedSegment[]> {
  log.info('Refining clip boundaries...');
  return refineSegments(rankedSegments, microBlocks, opts.maxParallel, opts.noCache);
}
