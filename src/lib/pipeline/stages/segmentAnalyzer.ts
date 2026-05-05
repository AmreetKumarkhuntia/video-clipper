import { LLMAnalyzer } from '@lib/services/analysis/llm/LLMAnalyzer.js';
import { TranscriptDetector } from '@lib/services/analysis/transcript/detector.js';
import { createTranscriptChain } from '@lib/services/audio/transcriber/index.js';
import { refineSegments } from '@lib/services/analysis/refiner/index.js';
import { log } from '@lib/utils/logger.js';
import type { Cache } from '@lib/utils/cache.js';
import type {
  AudioEvent,
  MicroBlock,
  RankedSegment,
  SegmentAnalyzerOpts,
  SegmentAnalyzerResult,
} from '@lib/types/index.js';

export async function analyzeSegments(
  videoId: string,
  audioPath: string | null,
  audioEvents: AudioEvent[],
  cache: Cache,
  opts: SegmentAnalyzerOpts,
): Promise<SegmentAnalyzerResult> {
  const done = log.fnCalled('analyzeSegments', { videoId }, opts.requestId);

  const chain = createTranscriptChain(opts.transcriptProvider, opts.transcriptChainConfig);
  const transcriptDetector = new TranscriptDetector(
    chain,
    opts.microBlockSec,
    opts.chunkLengthSec,
    opts.chunkOverlapSec,
  );
  const analyzer = new LLMAnalyzer(
    transcriptDetector,
    cache,
    opts.model,
    opts.maxChunks,
    opts.maxRetries,
    opts.systemPrompt,
    opts.llmModel,
    opts.callbacks,
  );

  const { lines, microBlocks, chunks, chunkEvals } = await analyzer.analyze({
    videoId,
    audioPath,
    audioEvents,
    maxChunks: opts.maxChunks,
    maxParallel: opts.maxParallel,
    noCache: opts.noCache,
    requestId: opts.requestId,
  });

  done({});
  return { lines, microBlocks, chunks, chunkEvals };
}

export async function refineRankedSegments(
  rankedSegments: RankedSegment[],
  microBlocks: MicroBlock[],
  cache: Cache,
  opts: Pick<
    SegmentAnalyzerOpts,
    'maxParallel' | 'noCache' | 'maxRetries' | 'model' | 'callbacks' | 'requestId' | 'videoTitle'
  >,
): Promise<RankedSegment[]> {
  const done = log.fnCalled(
    'refineRankedSegments',
    { segments: rankedSegments.length },
    opts.requestId,
  );
  const result = await refineSegments(
    rankedSegments,
    microBlocks,
    opts.maxParallel,
    cache,
    opts.noCache,
    {
      maxRetries: opts.maxRetries,
      model: opts.model,
      requestId: opts.requestId,
      videoTitle: opts.videoTitle,
      callbacks: opts.callbacks
        ? {
            onSegmentTextDelta: opts.callbacks.onSegmentTextDelta,
            onSegmentRefined: opts.callbacks.onSegmentRefined,
          }
        : undefined,
    },
  );
  done({});
  return result;
}
