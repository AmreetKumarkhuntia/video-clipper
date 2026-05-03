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

// ── Types & Schemas ──
export { ConfigSchema } from './types/config.js';
export type { Config } from './types/config.js';

export { TranscriptLineSchema, MicroBlockSchema, LLMChunkSchema } from './types/transcript.js';
export type { TranscriptLine, MicroBlock, LLMChunk } from './types/transcript.js';

export {
  AnalyzedSegmentSchema,
  RankedSegmentSchema,
  ChunkEvaluationSchema,
} from './types/segment.js';
export type { AnalyzedSegment, RankedSegment, ChunkEvaluation } from './types/segment.js';

export { AudioEventSchema, MergedCandidateSchema } from './types/audio.js';
export type { AudioEvent, MergedCandidate } from './types/audio.js';

export { VideoMetadataSchema, PipelineResultSchema } from './types/video.js';
export type { VideoMetadata, PipelineResult } from './types/video.js';

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

export type {
  LLMAnalyzerResult,
  LLMAnalyzerOpts,
  TranscriptDetectorResult,
} from './types/analyzer.js';

export type {
  DownloadMode,
  DownloadResultAll,
  DownloadResultSegments,
  DownloadResult,
} from './types/downloader.js';

export { SegmentRefinementSchema } from './types/cache.js';
export type { SegmentRefinement } from './types/cache.js';

export type { TranscriptProviderName, AudioProviderName } from './types/factory.js';

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
export { getModel } from './utils/modelFactory.js';
export { Cache } from './utils/cache.js';
export type { CacheBackend } from './utils/cacheBackend.js';
export { createCacheBackend } from './utils/cacheFactory.js';

// ── Services ──
export { parseUrl } from './services/urlParser/index.js';
export { extractMetadata } from './services/metadataExtractor/index.js';
export { buildMicroBlocks, buildLLMChunks } from './services/chunkBuilder/index.js';
export { analyzeChunks } from './services/llmAnalyzer/index.js';
export { LLMAnalyzer } from './services/llmAnalyzer/LLMAnalyzer.js';
export { mergeSignals, rankSegments } from './services/segmentRanker/index.js';
export { refineSegments } from './services/clipRefiner/index.js';
export { TranscriptDetector } from './services/transcriptDetector/index.js';
export {
  TranscriptAnalyzer,
  createTranscriptChain,
  parseTranscriptProviderChain,
} from './services/transcriptAnalyzers/index.js';
export { downloadAudio } from './services/audioDownloader/index.js';
export { sliceAudio } from './services/audioDownloader/sliceAudio.js';
export {
  AudioAnalyzer,
  createAnalyzerChain,
  parseProviderChain,
} from './services/audioAnalyzers/index.js';
export { EventDetector } from './services/eventDetector/index.js';
export { downloadVideo } from './services/videoDownloader/index.js';
export { generateClips, organizeClips } from './services/clipGenerator/index.js';
export {
  GoogleYouTubeCatalogService,
  parseChannelInput,
  parseYouTubeDuration,
} from './services/youtube/catalog.js';
export type { YouTubeCatalogService } from './services/youtube/catalog.js';

// ── Shared Pipeline Stages ──
export { analyzeSegments, refineRankedSegments } from './pipeline/stages/segmentAnalyzer.js';
export { selectSegments } from './pipeline/stages/segmentSelector.js';
export { exportClips } from './pipeline/stages/clipExporter.js';
