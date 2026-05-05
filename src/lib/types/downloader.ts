export interface YtDlpCookies {
  cookiesFromBrowser?: string;
  cookiesFile?: string;
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
