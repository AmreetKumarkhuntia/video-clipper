import { log } from '@lib/utils/logger.js';
import { formatSeconds } from '@lib/utils/format.js';
import type { StreamCallbacks, ChunkEvaluation, RankedSegment } from '@lib/types/index.js';

export function createAnalysisCallbacks(totalChunks: number, requestId: string): StreamCallbacks {
  let analyzedCount = 0;

  return {
    onChunkStarted: (chunkIndex: number) => {
      log.info('analyze', `Analyzing chunk ${chunkIndex + 1}/${totalChunks}...`, requestId);
    },
    onChunkTextDelta: (_chunkIndex: number, _text: string) => {
      // streaming text deltas — silent in CLI (too noisy)
    },
    onChunkAnalyzed: (chunkIndex: number, evaluation: ChunkEvaluation) => {
      analyzedCount++;
      if (evaluation.status === 'success') {
        log.info(
          'analyze',
          `  [${analyzedCount}/${totalChunks}] chunk ${chunkIndex + 1}: score=${evaluation.score} interesting=${evaluation.interesting}`,
          requestId,
        );
      } else {
        log.warn(
          'analyze',
          `  [${analyzedCount}/${totalChunks}] chunk ${chunkIndex + 1}: failed — ${evaluation.error}`,
          requestId,
        );
      }
    },
    onSegmentStarted: (rank: number) => {
      log.info('analyze', `Refining segment rank ${rank}...`, requestId);
    },
    onSegmentTextDelta: (_rank: number, _text: string) => {
      // streaming text deltas — silent in CLI
    },
    onSegmentRefined: (rank: number, segment: RankedSegment) => {
      log.info(
        'analyze',
        `  segment rank=${rank}: ${formatSeconds(segment.start)}-${formatSeconds(segment.end)} (score=${segment.score})`,
        requestId,
      );
    },
  };
}
