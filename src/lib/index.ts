/**
 * Public programmatic API for @thunderkiller/video-clipper.
 *
 * This module re-exports all shared library code: types, schemas, config,
 * utilities, services, and shared pipeline stages.
 *
 * CLI-only code (runPipeline, parseArgs) and web-only code are NOT exported
 * here — import them directly from @app/cli or @app/web.
 */

// ── Config ──
export { config } from './config/index.js';

// ── Types & Schemas (cross-cutting, in types/) ──
export { ConfigSchema } from './types/config.js';
export type { Config } from './types/config.js';

export type { CliArgs } from './types/cli.js';

export type {
  ChunkWindow,
  VideoResolverResult,
  AudioProcessorOpts,
  SegmentAnalyzerOpts,
  SegmentAnalyzerResult,
  SegmentSelectorOpts,
  ClipExporterOpts,
} from './types/pipeline.js';

export type { TranscriptProviderName, AudioProviderName } from './types/factory.js';

// ── Types re-exported from types/ ──
export { TranscriptLineSchema, MicroBlockSchema, LLMChunkSchema } from './types/transcript.js';
export type { TranscriptLine, MicroBlock, LLMChunk } from './types/transcript.js';

export {
  AnalyzedSegmentSchema,
  RankedSegmentSchema,
  ChunkEvaluationSchema,
} from './types/segment.js';
export type { AnalyzedSegment, RankedSegment, ChunkEvaluation } from './types/segment.js';
export type {
  LLMAnalyzerResult,
  LLMAnalyzerOpts,
  TranscriptDetectorResult,
} from './types/analyzer.js';

export { AudioEventSchema, MergedCandidateSchema } from './types/audio.js';
export type { AudioEvent, MergedCandidate } from './types/audio.js';

export { VideoMetadataSchema, PipelineResultSchema } from './types/video.js';
export type { VideoMetadata, PipelineResult } from './types/video.js';
export type {
  DownloadMode,
  DownloadResultAll,
  DownloadResultSegments,
  DownloadResult,
} from './types/video.js';

export {
  ChannelSummarySchema,
  VideoSummarySchema,
  VideoDetailsSchema,
  VideoPageSchema,
  YouTubeThumbnailSchema,
} from './types/youtube.js';
export type {
  ChannelSummary,
  VideoSummary,
  VideoDetails,
  VideoPage,
  YouTubeThumbnail,
} from './types/youtube.js';

// ── Utils ──
export { log } from './utils/logger.js';
export { formatConfig, formatSeconds } from './utils/format.js';
export { scriptPath, PACKAGE_ROOT } from './utils/paths.js';
export { getPythonBin } from './utils/pythonBin.js';
export { buildWindows } from './utils/chunker.js';
export { Model, AudioModel, defineTool } from './services/modelFactory/index.js';
export { Cache, createCacheBackend } from './services/cache/index.js';
export type { CacheBackend } from './types/cache.js';

// ── Video Services ──
export {
  parseUrl,
  extractMetadata,
  downloadVideo,
  generateClips,
  organizeClips,
  GoogleYouTubeCatalogService,
  parseChannelInput,
  parseYouTubeDuration,
} from './services/video/index.js';
export type { YouTubeCatalogService } from './types/youtube.js';

// ── Audio Services ──
export {
  downloadAudio,
  sliceAudio,
  EventDetector,
  TranscriptAnalyzer,
  createTranscriptChain,
  parseTranscriptProviderChain,
  AudioAnalyzer,
  createAnalyzerChain,
  parseProviderChain,
} from './services/audio/index.js';

// ── Analysis Services ──
export {
  analyzeChunks,
  LLMAnalyzer,
  refineSegments,
  mergeSignals,
  rankSegments,
  buildMicroBlocks,
  buildLLMChunks,
  TranscriptDetector,
} from './services/analysis/index.js';

// ── Shared Pipeline Stages ──
export { analyzeSegments, refineRankedSegments } from './pipeline/stages/segmentAnalyzer.js';
export { selectSegments } from './pipeline/stages/segmentSelector.js';
export { exportClips } from './pipeline/stages/clipExporter.js';
