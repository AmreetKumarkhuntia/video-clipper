import { fetchTranscript } from '../transcriptFetcher/index.js';
import { buildMicroBlocks, buildLLMChunks } from '../chunkBuilder/index.js';
import { config } from '../../config/index.js';
import type { Cache } from '../../utils/cache.js';
import type { TranscriptLine, MicroBlock, LLMChunk } from '../../types/index.js';

export interface TranscriptDetectorResult {
  lines: TranscriptLine[];
  microBlocks: MicroBlock[];
  chunks: LLMChunk[];
}

/**
 * Top-level transcript detector.
 *
 * Encapsulates the three-step transcript pipeline:
 *   1. Fetch raw transcript lines via yt-dlp (with cache)
 *   2. Group lines into micro-blocks (~15s windows)
 *   3. Build overlapping LLM analysis chunks (120s / 20s overlap)
 *
 * Keeping these steps together under one class makes the "transcript concern"
 * self-contained and independently testable — callers only need to call
 * `detect()` and receive the fully prepared result.
 *
 * @example
 *   const detector = new TranscriptDetector();
 *   const { lines, microBlocks, chunks } = await detector.detect(videoId, cache);
 */
export class TranscriptDetector {
  /**
   * Fetches, groups, and chunks the transcript for the given video ID.
   * Results are cached via the injected Cache instance.
   */
  async detect(videoId: string, cache: Cache): Promise<TranscriptDetectorResult> {
    let lines: TranscriptLine[];

    const cached = await cache.readTranscript(videoId);
    if (cached) {
      lines = cached;
    } else {
      lines = await fetchTranscript(videoId);
      await cache.writeTranscript(videoId, lines);
    }

    const microBlocks = this.buildMicroBlocks(lines);
    const chunks = this.buildChunks(microBlocks);

    return { lines, microBlocks, chunks };
  }

  /** Groups raw transcript lines into micro-blocks. */
  buildMicroBlocks(lines: TranscriptLine[]): MicroBlock[] {
    return buildMicroBlocks(lines, config.MICRO_BLOCK_SEC);
  }

  /** Builds overlapping LLM analysis chunks from micro-blocks. */
  buildChunks(microBlocks: MicroBlock[]): LLMChunk[] {
    return buildLLMChunks(microBlocks, config.CHUNK_LENGTH_SEC, config.CHUNK_OVERLAP_SEC);
  }
}
