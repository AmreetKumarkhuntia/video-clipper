import { analyzeChunks } from './index.js';
import type { AnalyzeChunksOpts } from './index.js';
import { refineSegments } from '../refiner/index.js';
import type { RefineSegmentsOpts } from '../refiner/index.js';
import { log } from '@lib/utils/logger.js';
import type { LanguageModel } from 'ai';
import type { TranscriptDetector } from '../transcript/detector.js';
import type { CacheBackend } from '@lib/utils/cacheBackend.js';
import type {
  TranscriptLine,
  MicroBlock,
  LLMChunk,
  AudioEvent,
  ChunkEvaluation,
  RankedSegment,
  LLMAnalyzerResult,
  LLMAnalyzerOpts,
} from '../types.js';

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
    private readonly cache: CacheBackend,
    private readonly model: LanguageModel,
    private readonly maxChunks: number | undefined,
    private readonly maxRetries: number,
    private readonly systemPrompt: string,
    private readonly llmModel: string,
  ) {}

  async analyze(opts: LLMAnalyzerOpts): Promise<LLMAnalyzerResult> {
    const { lines, microBlocks, chunks } = await this.transcriptDetector.detect(
      opts.videoId,
      opts.audioPath,
      this.cache,
    );

    const chunkLimit = opts.maxChunks ?? this.maxChunks;
    const chunksToAnalyze = chunkLimit !== undefined ? chunks.slice(0, chunkLimit) : chunks;

    if (chunkLimit !== undefined) {
      log.info(
        `Limiting evaluation to ${chunksToAnalyze.length} of ${chunks.length} chunks (--max-chunks ${chunkLimit})`,
      );
    }

    log.info(
      `Analyzing chunks with ${this.llmModel} (${chunksToAnalyze.length} chunks, max ${opts.maxParallel} parallel)...`,
    );

    const analyzeOpts: AnalyzeChunksOpts = {
      maxRetries: this.maxRetries,
      systemPrompt: this.systemPrompt,
      model: this.model,
    };

    const chunkEvals = await analyzeChunks(
      chunksToAnalyze,
      lines,
      opts.audioEvents,
      opts.maxParallel,
      this.cache,
      opts.noCache,
      analyzeOpts,
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
    const refineOpts: RefineSegmentsOpts = {
      maxRetries: this.maxRetries,
      model: this.model,
    };
    return refineSegments(
      rankedSegments,
      microBlocks,
      opts.maxParallel,
      this.cache,
      opts.noCache,
      refineOpts,
    );
  }
}
