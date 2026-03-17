import { fetchTranscript } from '../../services/transcriptFetcher/index.js';
import { buildMicroBlocks, buildLLMChunks } from '../../services/chunkBuilder/index.js';
import { dumpTranscript } from '../../utils/dumper.js';
import { log } from '../../utils/logger.js';
import type { Cache } from '../../utils/cache.js';
import type {
  TranscriptResult,
  TranscriptProcessorOpts,
  TranscriptLine,
} from '../../types/index.js';
import { config } from '../../config/index.js';

export type { TranscriptResult, TranscriptProcessorOpts };

/**
 * Stage 2 — Transcript Processor
 *
 * Fetches the YouTube transcript (with cache), groups lines into micro-blocks,
 * then builds overlapping LLM analysis chunks. Optionally dumps raw transcript
 * to disk for inspection.
 *
 * All caching is handled internally via the injected `Cache` instance.
 */
export async function processTranscript(
  videoId: string,
  cache: Cache,
  opts: TranscriptProcessorOpts,
): Promise<TranscriptResult> {
  // Fetch transcript (cache-first)
  log.info('Fetching transcript...');
  let lines: TranscriptLine[];

  const cached = await cache.readTranscript(videoId);
  if (cached) {
    lines = cached;
    log.info(`[cache hit] Transcript loaded from cache (${lines.length} lines)`);
  } else {
    lines = await fetchTranscript(videoId);
    await cache.writeTranscript(videoId, lines);
  }

  // Optional dump
  if (opts.dumpOutputs) {
    await dumpTranscript(videoId, lines);
  }

  // Build micro-blocks → LLM chunks
  const microBlocks = buildMicroBlocks(lines, config.MICRO_BLOCK_SEC);
  const chunks = buildLLMChunks(microBlocks, config.CHUNK_LENGTH_SEC, config.CHUNK_OVERLAP_SEC);

  log.info(
    `Transcript: ${lines.length} lines → ${microBlocks.length} micro-blocks → ${chunks.length} chunks`,
  );

  return { lines, microBlocks, chunks };
}
