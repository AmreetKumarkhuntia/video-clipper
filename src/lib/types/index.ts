export { ConfigSchema } from './config.js';
export type { Config } from './config.js';
export type {
  ModelFactoryApiKeys,
  SetConfigResult,
  ConfigFieldDescriptor,
  ConfigGroupDescriptor,
  ConfigRegistryResponse,
} from './config.js';

export type { CliArgs } from './cli.js';

export type {
  ChunkWindow,
  VideoResolverResult,
  AudioProcessorOpts,
  SegmentAnalyzerOpts,
  SegmentAnalyzerResult,
  SegmentSelectorOpts,
  ClipExporterOpts,
  ClipExporterConfig,
  AudioProcessorConfig,
} from './pipeline.js';

export type { CacheBackend, CacheDocument } from './cache.js';

export type { TranscriptProviderName, AudioProviderName } from './factory.js';

export { TranscriptLineSchema, MicroBlockSchema, LLMChunkSchema } from './transcript.js';
export type { TranscriptLine, MicroBlock, LLMChunk } from './transcript.js';

export { AnalyzedSegmentSchema, RankedSegmentSchema, ChunkEvaluationSchema } from './segment.js';
export type { AnalyzedSegment, RankedSegment, ChunkEvaluation } from './segment.js';

export type {
  LLMAnalyzerResult,
  LLMAnalyzerOpts,
  TranscriptDetectorResult,
  StreamCallbacks,
  AnalyzeChunksOpts,
  RefineSegmentsOpts,
} from './analyzer.js';
export { RefinedBoundariesSchema } from './analyzer.js';

export {
  AudioEventSchema,
  MergedCandidateSchema,
  GeminiEventSchema,
  WhisperSegmentSchema,
} from './audio.js';
export type {
  AudioEvent,
  MergedCandidate,
  AudioSource,
  GeminiAnalyzerConfig,
  AnalyzerChainConfig,
  SlicerConfig,
} from './audio.js';

export { VideoMetadataSchema, PipelineResultSchema } from './video.js';
export type {
  VideoMetadata,
  PipelineResult,
  DownloadMode,
  DownloadResultAll,
  DownloadResultSegments,
  DownloadResult,
  VideoSource,
  ClipperConfig,
} from './video.js';

export {
  YouTubeThumbnailSchema,
  ChannelSummarySchema,
  VideoSummarySchema,
  VideoDetailsSchema,
  VideoPageSchema,
} from './youtube.js';
export type {
  YouTubeThumbnail,
  ChannelSummary,
  VideoSummary,
  VideoDetails,
  VideoPage,
  YouTubeCatalogService,
  ChannelLookup,
  YtDlpJson,
  OEmbedResponse,
  YouTubeCaptionTrack,
  YouTubePlayerResponse,
} from './youtube.js';

export type { ChannelInput, ChunkInsert, SegmentationInsert, UpsertClipInput } from './db.js';

export type {
  YtDlpCookies,
  DownloaderConfig,
  AudioDownloadConfig,
  TranscriptChainConfig,
} from './downloader.js';

export {
  ViewportPresetSchema,
  CropFocusSchema,
  ViewportSchema,
  TrimSchema,
  TextStyleSchema,
  PositionSchema,
  WordTokenSchema,
  SubtitleLineSchema,
  TextOverlaySchema,
  ClipEditsSchema,
} from './clipEdit.js';
export type {
  ViewportPreset,
  CropFocus,
  Viewport,
  Trim,
  TextStyle,
  Position,
  WordToken,
  SubtitleLine,
  TextOverlay,
  ClipEdits,
  FilterGraphResult,
} from './clipEdit.js';
