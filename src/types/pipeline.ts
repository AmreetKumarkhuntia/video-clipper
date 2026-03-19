import type {
  VideoMetadata,
  TranscriptLine,
  MicroBlock,
  LLMChunk,
  ChunkEvaluation,
} from './index.js';

/** A half-open time window [start, end) in seconds. Returned by `buildWindows`. */
export interface ChunkWindow {
  /** Start of the window in seconds (inclusive). */
  start: number;
  /** End of the window in seconds (exclusive upper bound). */
  end: number;
}

export interface VideoResolverResult {
  videoId: string;
  metadata: VideoMetadata;
}

export interface AudioProcessorOpts {
  noAudio: boolean;
  gameProfile: string;
  maxParallel: number;
  /** Pre-downloaded audio WAV path. When provided, skips the downloadAudio call. */
  audioPath?: string | null;
}

export interface SegmentAnalyzerOpts {
  maxChunks?: number;
  maxParallel: number;
  noCache: boolean;
}

export interface SegmentAnalyzerResult {
  lines: TranscriptLine[];
  microBlocks: MicroBlock[];
  chunks: LLMChunk[];
  chunkEvals: ChunkEvaluation[];
}

export interface SegmentSelectorOpts {
  threshold: number;
  topN: number;
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
}
