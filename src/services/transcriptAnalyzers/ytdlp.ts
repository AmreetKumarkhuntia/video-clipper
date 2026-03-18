import { fetchTranscript } from '../transcriptFetcher/index.js';
import type { TranscriptLine } from '../../types/index.js';
import { TranscriptAnalyzer } from './base.js';

/**
 * Fetches the YouTube transcript via yt-dlp auto-generated subtitles (VTT).
 *
 * This is the default transcript provider. It does not use the audio file —
 * the `audioPath` parameter is accepted but ignored.
 *
 * Requires: yt-dlp installed and available on PATH.
 */
export class YtDlpTranscriptAnalyzer extends TranscriptAnalyzer {
  readonly source = 'ytdlp' as const;

  async detect(videoId: string, _audioPath: string | null): Promise<TranscriptLine[]> {
    return fetchTranscript(videoId);
  }
}
