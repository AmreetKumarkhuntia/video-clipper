import { log } from '../../utils/logger.js';
import type { AudioAnalyzer } from '../audioAnalyzers/index.js';
import type { AudioEvent } from '../../types/index.js';

/**
 * Top-level audio event detector.
 *
 * Holds an ordered chain of AudioAnalyzer instances and walks the chain on each
 * `detect()` call: the first analyzer that succeeds wins. If an analyzer throws,
 * the error is logged and the next analyzer in the chain is tried. If the entire
 * chain is exhausted without success the error from the last analyzer is re-thrown.
 *
 * The chain is built once at startup via `createAnalyzerChain(config.AUDIO_PROVIDER)`
 * and injected here, keeping provider-selection logic out of this class.
 *
 * @example
 *   const chain    = createAnalyzerChain('gemini,whisper');
 *   const detector = new EventDetector(chain);
 *   const events   = await detector.detect(audioPath, 'valorant', 0, 120);
 */
export class EventDetector {
  constructor(private readonly chain: AudioAnalyzer[]) {
    if (chain.length === 0) {
      throw new Error('EventDetector requires at least one AudioAnalyzer in the chain.');
    }
  }

  /**
   * Detect audio events by walking the analyzer chain in order.
   * Falls back to the next analyzer whenever one throws.
   */
  async detect(
    audioPath: string,
    gameProfile: string,
    chunkOffsetSec: number,
    chunkDurationSec: number,
  ): Promise<AudioEvent[]> {
    let lastError: unknown;

    for (let i = 0; i < this.chain.length; i++) {
      const analyzer = this.chain[i];
      const isLast = i === this.chain.length - 1;

      try {
        const events = await analyzer.detect(
          audioPath,
          gameProfile,
          chunkOffsetSec,
          chunkDurationSec,
        );
        log.info(`[audio:${analyzer.source}] detected ${events.length} events`);
        return events;
      } catch (err) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);

        if (!isLast) {
          const nextSource = this.chain[i + 1].source;
          log.warn(`[audio:${analyzer.source}] failed, falling back to ${nextSource}: ${message}`);
        } else {
          log.error(`[audio:${analyzer.source}] failed (no more fallbacks): ${message}`);
        }
      }
    }

    throw lastError;
  }
}
