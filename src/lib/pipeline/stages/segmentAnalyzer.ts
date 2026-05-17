import { LLMAnalyzer } from '@lib/services/analysis/llm/LLMAnalyzer.js';
import { TranscriptDetector } from '@lib/services/analysis/transcript/detector.js';
import { createTranscriptChain } from '@lib/services/audio/transcriber/index.js';
import { refineSegments } from '@lib/services/analysis/refiner/index.js';
import { log } from '@lib/utils/logger.js';
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
  opts: SegmentAnalyzerOpts,
): Promise<SegmentAnalyzerResult> {
  const done = log.fnCalled('analyzeSegments', opts.requestId, { videoId });

  const chain = createTranscriptChain(opts.transcriptProvider, opts.transcriptChainConfig);
  const transcriptDetector = new TranscriptDetector(
    chain,
    opts.microBlockSec,
    opts.chunkLengthSec,
    opts.chunkOverlapSec,
  );
  const analyzer = new LLMAnalyzer(
    transcriptDetector,
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
    requestId: opts.requestId,
    signal: opts.signal,
  });

  done({});
  return { lines, microBlocks, chunks, chunkEvals };
}

export async function refineRankedSegments(
  rankedSegments: RankedSegment[],
  microBlocks: MicroBlock[],
  opts: Pick<
    SegmentAnalyzerOpts,
    'maxParallel' | 'maxRetries' | 'model' | 'callbacks' | 'requestId' | 'videoTitle' | 'signal'
  >,
): Promise<RankedSegment[]> {
  const done = log.fnCalled('refineRankedSegments', opts.requestId, {
    segments: rankedSegments.length,
  });
  const result = await refineSegments(rankedSegments, microBlocks, opts.maxParallel, {
    maxRetries: opts.maxRetries,
    model: opts.model,
    requestId: opts.requestId,
    videoTitle: opts.videoTitle,
    signal: opts.signal,
    callbacks: opts.callbacks
      ? {
          onSegmentTextDelta: opts.callbacks.onSegmentTextDelta,
          onSegmentRefined: opts.callbacks.onSegmentRefined,
        }
      : undefined,
  });
  done({});
  return result;
}
