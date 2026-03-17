/**
 * Pipeline-layer types: stage option bags, result shapes, and the generic
 * time-window interface from the chunker utility.
 *
 * All types here are owned by one pipeline stage but live centrally so the
 * runner (and any future consumers) can import them without reaching into
 * individual stage files.
 */

import type {
  VideoMetadata,
  TranscriptLine,
  MicroBlock,
  LLMChunk,
  ChunkEvaluation,
} from './index.js';

// ---------------------------------------------------------------------------
// Chunker utility
// ---------------------------------------------------------------------------

/** A half-open time window [start, end) in seconds. Returned by `buildWindows`. */
export interface ChunkWindow {
  /** Start of the window in seconds (inclusive). */
  start: number;
  /** End of the window in seconds (exclusive upper bound). */
  end: number;
}

// ---------------------------------------------------------------------------
// Stage 1 — Video Resolver
// ---------------------------------------------------------------------------

export interface VideoResolverResult {
  videoId: string;
  metadata: VideoMetadata;
}

// ---------------------------------------------------------------------------
// Stage 2 — Transcript Processor
// ---------------------------------------------------------------------------

export interface TranscriptProcessorOpts {
  dumpOutputs: boolean;
}

export interface TranscriptResult {
  lines: TranscriptLine[];
  microBlocks: MicroBlock[];
  chunks: LLMChunk[];
}

// ---------------------------------------------------------------------------
// Stage 3 — Audio Processor
// ---------------------------------------------------------------------------

export interface AudioProcessorOpts {
  noAudio: boolean;
  gameProfile: string;
}

// ---------------------------------------------------------------------------
// Stage 4a + 4b — Segment Analyzer / Refiner
// ---------------------------------------------------------------------------

export interface SegmentAnalyzerOpts {
  maxChunks?: number;
  maxParallel: number;
  noCache: boolean;
}

export interface SegmentAnalyzerResult {
  chunkEvals: ChunkEvaluation[];
}

// ---------------------------------------------------------------------------
// Stage 5 — Segment Selector
// ---------------------------------------------------------------------------

export interface SegmentSelectorOpts {
  threshold: number;
  topN: number;
}

// ---------------------------------------------------------------------------
// Stage 6 — Clip Exporter
// ---------------------------------------------------------------------------

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
