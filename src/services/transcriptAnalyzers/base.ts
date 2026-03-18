import type { TranscriptLine } from '../../types/index.js';

/**
 * Contract every transcript analyzer implementation must satisfy.
 *
 * Each concrete analyzer (YtDlp, Whisper, Gemini) extends this class and
 * implements `detect()`. The `source` property tags the lines it returns so
 * downstream logging knows which backend produced them.
 *
 * Usage:
 *   const analyzer = new YtDlpTranscriptAnalyzer();
 *   const lines    = await analyzer.detect(videoId, null);
 */
export abstract class TranscriptAnalyzer {
  abstract readonly source: string;

  /**
   * Fetch transcript lines for the given video.
   *
   * @param videoId   - YouTube video ID (no URL)
   * @param audioPath - Path to the downloaded WAV on disk, or null if audio
   *                    is not yet available (e.g. ytdlp path has no audio dep)
   * @returns Array of transcript lines sorted by start time
   */
  abstract detect(videoId: string, audioPath: string | null): Promise<TranscriptLine[]>;
}
