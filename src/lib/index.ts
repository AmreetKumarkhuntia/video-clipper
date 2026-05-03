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

export { SegmentRefinementSchema } from './types/cache.js';
export type { SegmentRefinement } from './types/cache.js';

export type { TranscriptProviderName, AudioProviderName } from './types/factory.js';

// ── Types re-exported from domain modules ──
export {
  TranscriptLineSchema,
  MicroBlockSchema,
  LLMChunkSchema,
} from './services/analysis/transcript/types.js';
export type { TranscriptLine, MicroBlock, LLMChunk } from './services/analysis/transcript/types.js';

export {
  AnalyzedSegmentSchema,
  RankedSegmentSchema,
  ChunkEvaluationSchema,
} from './services/analysis/types.js';
export type { AnalyzedSegment, RankedSegment, ChunkEvaluation } from './services/analysis/types.js';
export type {
  LLMAnalyzerResult,
  LLMAnalyzerOpts,
  TranscriptDetectorResult,
} from './services/analysis/types.js';

export { AudioEventSchema, MergedCandidateSchema } from './services/audio/types.js';
export type { AudioEvent, MergedCandidate } from './services/audio/types.js';

export { VideoMetadataSchema, PipelineResultSchema } from './services/video/types.js';
export type { VideoMetadata, PipelineResult } from './services/video/types.js';
export type {
  DownloadMode,
  DownloadResultAll,
  DownloadResultSegments,
  DownloadResult,
} from './services/video/types.js';

export {
  ChannelSummarySchema,
  VideoSummarySchema,
  VideoDetailsSchema,
  VideoPageSchema,
  YouTubeThumbnailSchema,
} from './services/video/source/youtube/types.js';
export type {
  ChannelSummary,
  VideoSummary,
  VideoDetails,
  VideoPage,
  YouTubeThumbnail,
} from './services/video/source/youtube/types.js';

// ── Utils ──
export { log } from './utils/logger.js';
export { formatConfig, formatSeconds } from './utils/format.js';
export { scriptPath, PACKAGE_ROOT } from './utils/paths.js';
export { getPythonBin } from './utils/pythonBin.js';
export { buildWindows } from './utils/chunker.js';
export { getModel } from './utils/modelFactory.js';
export { Cache } from './utils/cache.js';
export type { CacheBackend } from './utils/cacheBackend.js';
export { createCacheBackend } from './utils/cacheFactory.js';

// ── Video Services ──
export { parseUrl } from './services/video/source/youtube/parser.js';
export { extractMetadata } from './services/video/source/youtube/metadata.js';
export { downloadVideo } from './services/video/source/youtube/downloader.js';
export { generateClips, organizeClips } from './services/video/clipper/index.js';
export {
  GoogleYouTubeCatalogService,
  parseChannelInput,
  parseYouTubeDuration,
} from './services/video/source/youtube/catalog.js';
export type { YouTubeCatalogService } from './services/video/source/youtube/catalog.js';

// ── Audio Services ──
export { downloadAudio } from './services/audio/source/youtube.js';
export { sliceAudio } from './services/audio/processor/slicer.js';
export { EventDetector } from './services/audio/processor/detector.js';
export {
  TranscriptAnalyzer,
  createTranscriptChain,
  parseTranscriptProviderChain,
} from './services/audio/transcriber/index.js';
export {
  AudioAnalyzer,
  createAnalyzerChain,
  parseProviderChain,
} from './services/audio/analyzer/index.js';

// ── Analysis Services ──
export { analyzeChunks } from './services/analysis/llm/index.js';
export { LLMAnalyzer } from './services/analysis/llm/LLMAnalyzer.js';
export { refineSegments } from './services/analysis/refiner/index.js';
export { mergeSignals, rankSegments } from './services/analysis/ranker/index.js';
export { buildMicroBlocks, buildLLMChunks } from './services/analysis/transcript/chunker/index.js';
export { TranscriptDetector } from './services/analysis/transcript/detector.js';

// ── Shared Pipeline Stages ──
export { analyzeSegments, refineRankedSegments } from './pipeline/stages/segmentAnalyzer.js';
export { selectSegments } from './pipeline/stages/segmentSelector.js';
export { exportClips } from './pipeline/stages/clipExporter.js';
