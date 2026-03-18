import type { TranscriptLine } from '../../types/index.js';
import { TranscriptAnalyzer } from './base.js';

/**
 * Transcribes a video using Google Gemini's multimodal audio understanding.
 *
 * @stub This implementation is not yet complete. It will:
 *   1. Split the audio file into overlapping chunks
 *   2. Send each chunk to the Gemini audio API for transcription
 *   3. Stitch the returned text segments back into TranscriptLine[]
 *
 * Set TRANSCRIPT_PROVIDER=ytdlp or TRANSCRIPT_PROVIDER=whisper to use a
 * working provider in the meantime.
 */
export class GeminiTranscriptAnalyzer extends TranscriptAnalyzer {
  readonly source = 'gemini' as const;

  async detect(_videoId: string, _audioPath: string | null): Promise<TranscriptLine[]> {
    throw new Error(
      'GeminiTranscriptAnalyzer is not yet implemented. ' +
        'Use TRANSCRIPT_PROVIDER=ytdlp or TRANSCRIPT_PROVIDER=whisper instead.',
    );
  }
}
