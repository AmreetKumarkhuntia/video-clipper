import { TranscriptDetector } from '../../services/transcriptDetector/index.js';
import { createTranscriptChain } from '../../services/transcriptAnalyzers/index.js';
import { dumpTranscript } from '../../utils/dumper.js';
import { log } from '../../utils/logger.js';
import { config } from '../../config/index.js';
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
 * Builds the ordered TranscriptAnalyzer chain from config.TRANSCRIPT_PROVIDER
 * (e.g. "ytdlp" → [YtDlpTranscriptAnalyzer]), injects it into TranscriptDetector,
 * and delegates the full three-step pipeline:
 *   - Fetch raw transcript lines (with cache + provider fallback)
 *   - Group lines into micro-blocks
 *   - Build overlapping LLM analysis chunks
 *
 * Optionally dumps the raw transcript to disk for inspection.
 */
export async function processTranscript(
  videoId: string,
  cache: Cache,
  opts: TranscriptProcessorOpts,
): Promise<TranscriptResult> {
  log.info('Fetching transcript...');

  const chain = createTranscriptChain(config.TRANSCRIPT_PROVIDER);
  const detector = new TranscriptDetector(chain);
  const { lines, microBlocks, chunks } = await detector.detect(videoId, opts.audioPath, cache);

  log.info(
    `Transcript: ${lines.length} lines → ${microBlocks.length} micro-blocks → ${chunks.length} chunks`,
  );

  if (opts.dumpOutputs) {
    await dumpTranscript(videoId, lines as TranscriptLine[]);
  }

  return { lines, microBlocks, chunks };
}
