import { z } from 'zod';

export const TranscriptLineSchema = z.object({
  text: z.string(),
  start: z.number(),
  duration: z.number(),
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

export const MicroBlockSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});
export type MicroBlock = z.infer<typeof MicroBlockSchema>;

export const LLMChunkSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});
export type LLMChunk = z.infer<typeof LLMChunkSchema>;

/**
 * Contract for anything that can produce a transcript for a video.
 *
 * Satisfied by the `TranscriptAnalyzer` implementations in
 * `services/audio/transcriber` (ytdlp, whisper, gemini). Consumers such as
 * `TranscriptDetector` depend on this interface instead of the abstract class
 * so the analysis layer carries no import edge into the audio service.
 */
export interface TranscriptProvider {
  readonly source: string;

  /**
   * Fetch transcript lines for the given video.
   *
   * @param videoId   - YouTube video ID (no URL)
   * @param audioPath - Path to the downloaded WAV on disk, or null if audio
   *                    is not available (e.g. the ytdlp path has no audio dep)
   */
  detect(videoId: string, audioPath: string | null): Promise<TranscriptLine[]>;
}
