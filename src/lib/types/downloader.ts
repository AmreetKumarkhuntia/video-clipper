export interface YtDlpCookies {
  cookiesFromBrowser?: string;
  cookiesFile?: string;
  /** When true, suppresses live yt-dlp stdout/stderr streaming to the terminal. */
  quiet?: boolean;
  /** Number of times to retry a failed yt-dlp call (exponential backoff: 2s, 4s, 8s…). */
  retryCount?: number;
  /** Pass cookies during per-segment downloads (partial mode). Off by default — enables ANDROID_VR bypass for public videos. */
  segmentCookiesEnabled?: boolean;
  /** Force a specific yt-dlp player client (e.g. 'android_vr', 'mweb'). 'auto' = let yt-dlp decide. */
  playerClient?: string;
  /** Skip SSL certificate verification (--no-check-certificates). */
  noCheckCertificates?: boolean;
  /** Force IPv4 connections (--force-ipv4). */
  forceIpv4?: boolean;
  /** Attempt to bypass geographic restrictions (--geo-bypass). */
  geoBypass?: boolean;
  /** Seconds to sleep between requests (--sleep-requests). 0 = disabled. */
  sleepRequests?: number;
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
