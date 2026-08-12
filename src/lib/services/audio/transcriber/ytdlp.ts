import type { TranscriptLine } from '@lib/types/transcript.js';
import type { YtDlpCookies } from '@lib/types/downloader.js';
import { TranscriptAnalyzer } from './base.js';
import { fetchTranscript } from '@lib/services/video/index.js';

/**
 * Fetches the YouTube transcript from YouTube caption tracks first, then
 * falls back to yt-dlp subtitle extraction when needed.
 *
 * This is the default transcript provider. It does not use the audio file —
 * the `audioPath` parameter is accepted but ignored.
 *
 * The caption fetching itself lives in the video service
 * (`services/video/source/youtube/subtitles.ts`); this class is the thin
 * TranscriptAnalyzer adapter over it, kept here so all transcript providers
 * live together under `audio/transcriber/`.
 */
export class YtDlpTranscriptAnalyzer extends TranscriptAnalyzer {
  readonly source = 'ytdlp' as const;

  constructor(
    private readonly cookies: YtDlpCookies = {},
    private readonly languageCode?: string,
  ) {
    super();
  }

  async detect(videoId: string, _audioPath: string | null): Promise<TranscriptLine[]> {
    return fetchTranscript(videoId, this.cookies, this.languageCode);
  }
}
