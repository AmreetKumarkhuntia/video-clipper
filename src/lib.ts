/**
 * Public programmatic API for @thunderkiller/video-clipper.
 *
 * Import from this entrypoint when using the package as a library:
 *
 *   import { runPipeline, parseArgs, config } from '@thunderkiller/video-clipper'
 *
 * For CLI usage, use the `video-clipper` binary that is installed alongside
 * the package (mapped via the `bin` field in package.json).
 */

export { runPipeline } from './pipeline/runner.js';
export { parseArgs, printUsage } from './cli.js';
export { config } from './config/index.js';
export { scriptPath, PACKAGE_ROOT } from './utils/paths.js';

// All public types and schemas
export type {
  Config,
  TranscriptLine,
  MicroBlock,
  LLMChunk,
  AnalyzedSegment,
  RankedSegment,
  ChunkEvaluation,
  AudioEvent,
  MergedCandidate,
  VideoMetadata,
  PipelineResult,
  CliArgs,
  ChunkWindow,
  VideoResolverResult,
  AudioProcessorOpts,
  SegmentAnalyzerOpts,
  SegmentAnalyzerResult,
  SegmentSelectorOpts,
  ClipExporterOpts,
  LLMAnalyzerResult,
  LLMAnalyzerOpts,
  TranscriptDetectorResult,
  DownloadMode,
  DownloadResultAll,
  DownloadResultSegments,
  DownloadResult,
  SegmentRefinement,
  TranscriptProviderName,
  AudioProviderName,
} from './types/index.js';

// Zod schemas for consumers who want to validate data themselves
export {
  ConfigSchema,
  TranscriptLineSchema,
  MicroBlockSchema,
  LLMChunkSchema,
  AnalyzedSegmentSchema,
  RankedSegmentSchema,
  ChunkEvaluationSchema,
  AudioEventSchema,
  MergedCandidateSchema,
  VideoMetadataSchema,
  PipelineResultSchema,
  SegmentRefinementSchema,
} from './types/index.js';
