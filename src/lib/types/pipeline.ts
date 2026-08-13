import type { LLMAnalyzerResult, StreamCallbacks } from './analyzer.js';
import type { Model } from './modelFactory.js';
import type { TranscriptChainConfig, DownloaderConfig } from './downloader.js';
import type { ClipperConfig } from './video.js';

/** A half-open time window [start, end) in seconds. Returned by `buildWindows`. */
export interface ChunkWindow {
  /** Start of the window in seconds (inclusive). */
  start: number;
  /** End of the window in seconds (exclusive upper bound). */
  end: number;
}

export interface SegmentAnalyzerOpts {
  maxChunks?: number;
  maxParallel: number;
  requestId?: string;
  transcriptProvider: string;
  transcriptChainConfig: TranscriptChainConfig;
  microBlockSec: number;
  chunkLengthSec: number;
  chunkOverlapSec: number;
  model: Model;
  maxRetries: number;
  systemPrompt: string;
  llmModel: string;
  callbacks?: StreamCallbacks;
  /** Optional video title, threaded to the refiner prompt for boundary context. */
  videoTitle?: string;
  /** Optional AbortSignal threaded down to the underlying LLM streamText calls. */
  signal?: AbortSignal;
}

export type SegmentAnalyzerResult = LLMAnalyzerResult;

export interface SegmentSelectorOpts {
  threshold: number;
  topN: number;
  boostWindow: number;
  scoreBoost: number;
  preRoll: number;
  postRoll: number;
}

export interface ClipExporterOpts {
  /** Path to a pre-existing local video file. Skips yt-dlp download entirely. */
  localVideo?: string;
  /**
   * yt-dlp download strategy.
   *   - `'all'`   — download the full video, then cut clips with ffmpeg
   *   - number    — download only the top-N segments via --download-sections
   *   - undefined — same as `'all'`
   */
  downloadSections: 'all' | number | undefined;
  /** Custom output/download directory (overrides config.DOWNLOAD_DIR / config.OUTPUT_DIR). */
  videoPath?: string;
  clipConcurrency: number;
}

export interface ClipExporterConfig {
  downloader: DownloaderConfig;
  clipper: ClipperConfig;
  downloadSectionsMode: 'all' | number | undefined;
}
