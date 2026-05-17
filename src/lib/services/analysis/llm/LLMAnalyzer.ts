import { analyzeChunks } from './index.js';
import { refineSegments } from '../refiner/index.js';
import { log } from '@lib/utils/logger.js';
import type { LanguageModel } from 'ai';
import type { TranscriptDetector } from '../transcript/detector.js';
import type {
  MicroBlock,
  RankedSegment,
  LLMAnalyzerResult,
  LLMAnalyzerOpts,
  StreamCallbacks,
  AnalyzeChunksOpts,
  RefineSegmentsOpts,
} from '@lib/types/index.js';

export class LLMAnalyzer {
  constructor(
    private readonly transcriptDetector: TranscriptDetector,
    private readonly model: LanguageModel,
    private readonly maxChunks: number | undefined,
    private readonly maxRetries: number,
    private readonly systemPrompt: string,
    private readonly llmModel: string,
    private readonly callbacks?: StreamCallbacks,
  ) {}

  async analyze(opts: LLMAnalyzerOpts): Promise<LLMAnalyzerResult> {
    const { lines, microBlocks, chunks } = await this.transcriptDetector.detect(
      opts.videoId,
      opts.audioPath,
    );

    const chunkLimit = opts.maxChunks ?? this.maxChunks;
    const chunksToAnalyze = chunkLimit !== undefined ? chunks.slice(0, chunkLimit) : chunks;

    if (chunkLimit !== undefined) {
      log.info(
        'LLMAnalyzer.analyze',
        `Limiting evaluation to ${chunksToAnalyze.length} of ${chunks.length} chunks (--max-chunks ${chunkLimit})`,
        opts.requestId,
      );
    }

    log.info(
      'LLMAnalyzer.analyze',
      `Analyzing chunks with ${this.llmModel} (${chunksToAnalyze.length} chunks, max ${opts.maxParallel} parallel)...`,
      opts.requestId,
    );

    const analyzeOpts: AnalyzeChunksOpts = {
      maxRetries: this.maxRetries,
      systemPrompt: this.systemPrompt,
      model: this.model,
      requestId: opts.requestId,
      signal: opts.signal,
      callbacks: this.callbacks
        ? {
            onChunkTextDelta: this.callbacks.onChunkTextDelta,
            onChunkAnalyzed: this.callbacks.onChunkAnalyzed,
          }
        : undefined,
    };

    const chunkEvals = await analyzeChunks(
      chunksToAnalyze,
      lines,
      opts.audioEvents,
      opts.maxParallel,
      analyzeOpts,
    );

    const succeededCount = chunkEvals.filter((e) => e.status === 'success').length;
    if (succeededCount === 0) {
      throw new Error('All chunks failed LLM analysis. Check your API key and model config.');
    }

    return { lines, microBlocks, chunks, chunkEvals };
  }

  async refine(
    rankedSegments: RankedSegment[],
    microBlocks: MicroBlock[],
    opts: Pick<LLMAnalyzerOpts, 'maxParallel' | 'requestId' | 'signal'>,
  ): Promise<RankedSegment[]> {
    log.info('LLMAnalyzer.refine', 'Refining clip boundaries...', opts.requestId);
    const refineOpts: RefineSegmentsOpts = {
      maxRetries: this.maxRetries,
      model: this.model,
      requestId: opts.requestId,
      signal: opts.signal,
      callbacks: this.callbacks
        ? {
            onSegmentTextDelta: this.callbacks.onSegmentTextDelta,
            onSegmentRefined: this.callbacks.onSegmentRefined,
          }
        : undefined,
    };
    return refineSegments(rankedSegments, microBlocks, opts.maxParallel, refineOpts);
  }
}
