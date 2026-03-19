import { buildMicroBlocks, buildLLMChunks } from '../chunkBuilder/index.js';
import { log } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import type { TranscriptAnalyzer } from '../transcriptAnalyzers/index.js';
import type { Cache } from '../../utils/cache.js';
import type {
  TranscriptLine,
  MicroBlock,
  LLMChunk,
  TranscriptDetectorResult,
} from '../../types/index.js';

/**
 * Top-level transcript detector.
 *
 * Holds an ordered chain of TranscriptAnalyzer instances and walks the chain
 * on each `detect()` call: the first analyzer that succeeds wins. If an
 * analyzer throws, the error is logged and the next analyzer in the chain is
 * tried. If the entire chain is exhausted without success the error from the
 * last analyzer is re-thrown.
 *
 * After obtaining raw transcript lines the detector groups them into
 * micro-blocks and builds overlapping LLM analysis chunks — keeping the full
 * "transcript concern" self-contained under one class.
 *
 * The chain is built once at startup via `createTranscriptChain(config.TRANSCRIPT_PROVIDER)`
 * and injected here, keeping provider-selection logic out of this class.
 *
 * Results are cached via the injected Cache instance so that repeat runs skip
 * the network round-trip to yt-dlp / Whisper.
 *
 * @example
 *   const chain    = createTranscriptChain('ytdlp,whisper');
 *   const detector = new TranscriptDetector(chain);
 *   const { lines, microBlocks, chunks } = await detector.detect(videoId, audioPath, cache);
 */
export class TranscriptDetector {
  constructor(private readonly chain: TranscriptAnalyzer[]) {
    if (chain.length === 0) {
      throw new Error('TranscriptDetector requires at least one TranscriptAnalyzer in the chain.');
    }
  }

  /**
   * Fetches, groups, and chunks the transcript for the given video ID.
   *
   * Walks the analyzer chain in order, falling back on error. Cache is checked
   * first (before any analyzer is tried) and written after the first successful
   * fetch so subsequent runs with the same provider config are instant.
   *
   * @param videoId   - YouTube video ID
   * @param audioPath - Path to the downloaded WAV, or null if audio is not yet available
   * @param cache     - Cache instance for read/write of transcript lines
   */
  async detect(
    videoId: string,
    audioPath: string | null,
    cache: Cache,
  ): Promise<TranscriptDetectorResult> {
    let lines: TranscriptLine[];

    const cached = await cache.readTranscript(videoId);
    if (cached) {
      log.info(`[cache hit] Transcript loaded from cache (${cached.length} lines)`);
      lines = cached;
    } else {
      lines = await this.fetchFromChain(videoId, audioPath);
      await cache.writeTranscript(videoId, lines);
    }

    const microBlocks = this.buildMicroBlocks(lines);
    const chunks = this.buildChunks(microBlocks);

    return { lines, microBlocks, chunks };
  }

  /**
   * Walks the analyzer chain in order.
   * Falls back to the next analyzer whenever one throws.
   */
  private async fetchFromChain(
    videoId: string,
    audioPath: string | null,
  ): Promise<TranscriptLine[]> {
    let lastError: unknown;

    for (let i = 0; i < this.chain.length; i++) {
      const analyzer = this.chain[i];
      const isLast = i === this.chain.length - 1;

      try {
        const lines = await analyzer.detect(videoId, audioPath);
        log.info(`[transcript:${analyzer.source}] fetched ${lines.length} lines`);
        return lines;
      } catch (err) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);

        if (!isLast) {
          const nextSource = this.chain[i + 1].source;
          log.warn(
            `[transcript:${analyzer.source}] failed, falling back to ${nextSource}: ${message}`,
          );
        } else {
          log.error(`[transcript:${analyzer.source}] failed (no more fallbacks): ${message}`);
        }
      }
    }

    throw lastError;
  }

  /** Groups raw transcript lines into micro-blocks. */
  private buildMicroBlocks(lines: TranscriptLine[]): MicroBlock[] {
    return buildMicroBlocks(lines, config.MICRO_BLOCK_SEC);
  }

  /** Builds overlapping LLM analysis chunks from micro-blocks. */
  private buildChunks(microBlocks: MicroBlock[]): LLMChunk[] {
    return buildLLMChunks(microBlocks, config.CHUNK_LENGTH_SEC, config.CHUNK_OVERLAP_SEC);
  }
}
