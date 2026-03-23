import { mergeSignals, rankSegments } from '../../services/segmentRanker/index.js';
import { log } from '../../utils/logger.js';
import type {
  ChunkEvaluation,
  AudioEvent,
  RankedSegment,
  SegmentSelectorOpts,
} from '../../types/index.js';

export type { SegmentSelectorOpts };

/**
 * Stage 5 — Segment Selector
 *
 * Merges transcript LLM evaluations with audio events (if any), then ranks
 * and deduplicates candidates to produce the final ordered list of segments.
 *
 * This stage sits between the two LLM passes: it runs after `analyzeSegments`
 * (pass 1) and its output feeds `refineRankedSegments` (pass 2).
 */
export function selectSegments(
  chunkEvals: ChunkEvaluation[],
  audioEvents: AudioEvent[],
  opts: SegmentSelectorOpts,
): RankedSegment[] {
  const merged = mergeSignals(chunkEvals, audioEvents);
  const ranked = rankSegments(merged, opts.threshold, opts.topN);

  if (ranked.length === 0) {
    log.warn(`No segments scored above threshold ${opts.threshold}. Try lowering --threshold.`);
  } else {
    log.info(
      `Analysis complete: ${ranked.length} segment${ranked.length !== 1 ? 's' : ''} above threshold ${opts.threshold}`,
    );
  }

  return ranked;
}
