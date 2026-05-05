export interface YtDlpCookies {
  cookiesFromBrowser?: string;
  cookiesFile?: string;
  /** When true, suppresses live yt-dlp stdout/stderr streaming to the terminal. */
  quiet?: boolean;
  /** Number of times to retry a failed yt-dlp call (exponential backoff: 2s, 4s, 8s…). */
  retryCount?: number;
}

export interface DownloaderConfig extends YtDlpCookies {
  downloadDir: string;
  timestampOffset: number;
  llmConcurrency: number;
}

export interface AudioDownloadConfig extends YtDlpCookies {
  ffmpegPath?: string;
}

export interface TranscriptChainConfig extends YtDlpCookies {
  whisperModel: string;
}
