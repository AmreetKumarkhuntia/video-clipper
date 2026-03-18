import { analyzeChunks } from './index.js';
import { refineSegments } from '../clipRefiner/index.js';
import { log } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import type { TranscriptDetector } from '../transcriptDetector/index.js';
import type { Cache } from '../../utils/cache.js';
import type {
  TranscriptLine,
  MicroBlock,
  LLMChunk,
  AudioEvent,
  ChunkEvaluation,
  RankedSegment,
} from '../../types/index.js';

export interface LLMAnalyzerResult {
  lines: TranscriptLine[];
  microBlocks: MicroBlock[];
  chunks: LLMChunk[];
  chunkEvals: ChunkEvaluation[];
}

export interface LLMAnalyzerOpts {
  videoId: string;
  audioPath: string | null;
  audioEvents: AudioEvent[];
  maxChunks?: number;
  maxParallel: number;
  noCache: boolean;
}

/**
 * LLMAnalyzer — orchestrates transcript fetching + LLM-based segment analysis.
 *
 * Owns a TranscriptDetector (which encapsulates the provider chain) and the
 * Cache. Audio events are provided externally — they are pre-computed by the
 * AudioProcessor stage so that the full per-chunk caching logic stays in
 * audioProcessor.ts and is not duplicated here.
 *
 * LLM pass 1 (`analyze`) — fetches transcript, runs chunk analysis.
 * LLM pass 2 (`refine`)  — tightens clip boundaries on ranked segments.
 *
 * The free functions in `llmAnalyzer/index.ts` and `clipRefiner/index.ts` are
 * NOT modified — this class wraps them.
 *
 * @example
 *   const analyzer  = new LLMAnalyzer(transcriptDetector, cache);
 *   const result    = await analyzer.analyze({ videoId, audioPath, audioEvents, ... });
 *   // ... ranking step ...
 *   const refined   = await analyzer.refine(rankedSegments, result.microBlocks, opts);
 */
export class LLMAnalyzer {
  constructor(
    private readonly transcriptDetector: TranscriptDetector,
    private readonly cache: Cache,
  ) {}

  /**
   * LLM pass 1 — fetch transcript then run chunk analysis.
   *
   * Returns lines, microBlocks, chunks, and chunkEvals so the caller has
   * everything needed for the ranking step.
   */
  async analyze(opts: LLMAnalyzerOpts): Promise<LLMAnalyzerResult> {
    // ── Transcript ────────────────────────────────────────────────────────────
    const { lines, microBlocks, chunks } = await this.transcriptDetector.detect(
      opts.videoId,
      opts.audioPath,
      this.cache,
    );

    // ── LLM pass 1 ────────────────────────────────────────────────────────────
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
      opts.audioEvents,
      opts.maxParallel,
      opts.noCache,
    );

    const succeededCount = chunkEvals.filter((e) => e.status === 'success').length;
    if (succeededCount === 0) {
      throw new Error('All chunks failed LLM analysis. Check your API key and model config.');
    }

    return { lines, microBlocks, chunks, chunkEvals };
  }

  /**
   * LLM pass 2 — tighten clip boundaries on already-ranked segments.
   * Must be called after ranking, since it takes `RankedSegment[]` as input.
   */
  async refine(
    rankedSegments: RankedSegment[],
    microBlocks: MicroBlock[],
    opts: Pick<LLMAnalyzerOpts, 'maxParallel' | 'noCache'>,
  ): Promise<RankedSegment[]> {
    log.info('Refining clip boundaries...');
    return refineSegments(rankedSegments, microBlocks, opts.maxParallel, opts.noCache);
  }
}
