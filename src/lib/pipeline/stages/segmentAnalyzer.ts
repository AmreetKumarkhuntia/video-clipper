import { LLMAnalyzer } from '@lib/services/analysis/llm/LLMAnalyzer.js';
import { TranscriptDetector } from '@lib/services/analysis/transcript/detector.js';
import { createTranscriptChain } from '@lib/services/audio/transcriber/index.js';
import { refineSegments } from '@lib/services/analysis/refiner/index.js';
import { log } from '@lib/utils/logger.js';
import { config } from '@lib/config/index.js';
import type { Cache } from '@lib/utils/cache.js';
import type {
  AudioEvent,
  MicroBlock,
  RankedSegment,
  SegmentAnalyzerOpts,
  SegmentAnalyzerResult,
} from '@lib/types/index.js';

/**
 * Stage 4a — Segment Analyzer (LLM pass 1)
 *
 * Builds a TranscriptDetector from config.TRANSCRIPT_PROVIDER and an
 * LLMAnalyzer that owns it. Fetches the transcript (cache-first) and runs
 * LLM chunk analysis informed by pre-computed audio events.
 *
 * Returns raw ChunkEvaluation results plus transcript data (lines, microBlocks,
 * chunks) so the runner has everything it needs for ranking.
 *
 * NOTE: `processTranscript` no longer needs to run as a separate stage before
 * this function — `LLMAnalyzer.analyze()` handles transcript fetching internally.
 */
export async function analyzeSegments(
  videoId: string,
  audioPath: string | null,
  audioEvents: AudioEvent[],
  cache: Cache,
  opts: SegmentAnalyzerOpts,
): Promise<SegmentAnalyzerResult> {
  log.info('Fetching transcript and analyzing segments...');

  const chain = createTranscriptChain(config.TRANSCRIPT_PROVIDER);
  const transcriptDetector = new TranscriptDetector(chain);
  const analyzer = new LLMAnalyzer(transcriptDetector, cache);

  const { lines, microBlocks, chunks, chunkEvals } = await analyzer.analyze({
    videoId,
    audioPath,
    audioEvents,
    maxChunks: opts.maxChunks,
    maxParallel: opts.maxParallel,
    noCache: opts.noCache,
  });

  return { lines, microBlocks, chunks, chunkEvals };
}

/**
 * Stage 4b — Segment Refiner (LLM pass 2)
 *
 * Calls refineSegments() directly — no TranscriptDetector needed here since
 * refinement only tightens clip boundaries and never touches the transcript.
 * Separated from `analyzeSegments` because ranking (stage 5) must happen
 * between the two passes.
 */
export async function refineRankedSegments(
  rankedSegments: RankedSegment[],
  microBlocks: MicroBlock[],
  cache: Cache,
  opts: Pick<SegmentAnalyzerOpts, 'maxParallel' | 'noCache'>,
): Promise<RankedSegment[]> {
  log.info('Refining clip boundaries...');
  return refineSegments(rankedSegments, microBlocks, opts.maxParallel, cache, opts.noCache);
}
