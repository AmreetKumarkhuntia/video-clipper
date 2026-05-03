export { ConfigSchema } from './config.js';
export type { Config } from './config.js';

export type { CliArgs } from './cli.js';

export type {
  ChunkWindow,
  VideoResolverResult,
  AudioProcessorOpts,
  SegmentAnalyzerOpts,
  SegmentAnalyzerResult,
  SegmentSelectorOpts,
  ClipExporterOpts,
} from './pipeline.js';

export { SegmentRefinementSchema } from './cache.js';
export type { SegmentRefinement } from './cache.js';

export type { TranscriptProviderName, AudioProviderName } from './factory.js';

// Re-exports from domain modules (types were moved to co-locate with their services)
export {
  TranscriptLineSchema,
  MicroBlockSchema,
  LLMChunkSchema,
} from '../services/analysis/transcript/types.js';
export type {
  TranscriptLine,
  MicroBlock,
  LLMChunk,
} from '../services/analysis/transcript/types.js';

export {
  AnalyzedSegmentSchema,
  RankedSegmentSchema,
  ChunkEvaluationSchema,
} from '../services/analysis/types.js';
export type {
  AnalyzedSegment,
  RankedSegment,
  ChunkEvaluation,
} from '../services/analysis/types.js';
export type {
  LLMAnalyzerResult,
  LLMAnalyzerOpts,
  TranscriptDetectorResult,
} from '../services/analysis/types.js';

export { AudioEventSchema, MergedCandidateSchema } from '../services/audio/types.js';
export type { AudioEvent, MergedCandidate } from '../services/audio/types.js';

export { VideoMetadataSchema, PipelineResultSchema } from '../services/video/types.js';
export type { VideoMetadata, PipelineResult } from '../services/video/types.js';
export type {
  DownloadMode,
  DownloadResultAll,
  DownloadResultSegments,
  DownloadResult,
} from '../services/video/types.js';

export {
  ChannelSummarySchema,
  VideoSummarySchema,
  VideoDetailsSchema,
  VideoPageSchema,
  YouTubeThumbnailSchema,
} from '../services/video/source/youtube/types.js';
export type {
  ChannelSummary,
  VideoSummary,
  VideoDetails,
  VideoPage,
  YouTubeThumbnail,
} from '../services/video/source/youtube/types.js';
