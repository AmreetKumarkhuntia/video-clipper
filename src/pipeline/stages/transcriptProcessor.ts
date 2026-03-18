import { TranscriptDetector } from '../../services/transcriptDetector/index.js';
import { dumpTranscript } from '../../utils/dumper.js';
import { log } from '../../utils/logger.js';
import type { Cache } from '../../utils/cache.js';
import type {
  TranscriptResult,
  TranscriptProcessorOpts,
  TranscriptLine,
} from '../../types/index.js';

export type { TranscriptResult, TranscriptProcessorOpts };

/**
 * Stage 2 — Transcript Processor
 *
 * Delegates to TranscriptDetector which encapsulates:
 *   - Fetching the YouTube transcript (with cache)
 *   - Grouping lines into micro-blocks
 *   - Building overlapping LLM analysis chunks
 *
 * Optionally dumps the raw transcript to disk for inspection.
 */
export async function processTranscript(
  videoId: string,
  cache: Cache,
  opts: TranscriptProcessorOpts,
): Promise<TranscriptResult> {
  log.info('Fetching transcript...');

  const detector = new TranscriptDetector();
  const { lines, microBlocks, chunks } = await detector.detect(videoId, cache);

  log.info(
    `Transcript: ${lines.length} lines → ${microBlocks.length} micro-blocks → ${chunks.length} chunks`,
  );

  if (opts.dumpOutputs) {
    await dumpTranscript(videoId, lines as TranscriptLine[]);
  }

  return { lines, microBlocks, chunks };
}
