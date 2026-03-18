import type { AudioEvent } from '../../types/index.js';

/**
 * Contract every audio analyzer implementation must satisfy.
 *
 * Each concrete analyzer (Gemini, Whisper, YAMNet) extends this class and
 * implements `detect()`. The `source` property is used to tag the events they
 * return so downstream code knows which backend produced them.
 *
 * Usage:
 *   const analyzer = new GeminiAudioAnalyzer();
 *   const events   = await analyzer.detect(audioPath, gameProfile, offsetSec, durationSec);
 */
export abstract class AudioAnalyzer {
  abstract readonly source: AudioEvent['source'];

  /**
   * Detect audio events in the given WAV slice.
   *
   * @param audioPath        - Path to the WAV audio slice on disk
   * @param gameProfile      - Profile key used to tune detection prompts/classes
   * @param chunkOffsetSec   - Absolute start time of this slice within the full video (seconds)
   * @param chunkDurationSec - Duration of this slice in seconds
   * @returns Array of detected events with absolute timestamps
   */
  abstract detect(
    audioPath: string,
    gameProfile: string,
    chunkOffsetSec: number,
    chunkDurationSec: number,
  ): Promise<AudioEvent[]>;
}
