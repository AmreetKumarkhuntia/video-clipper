/**
 * Public programmatic API for @thunderkiller/video-clipper.
 *
 * This module re-exports all shared library code: types, schemas, config,
 * utilities, services, orchestration, and shared pipeline stages.
 *
 * CLI-only and web-only code are NOT exported here — import them directly
 * from @app/cli or @app/web.
 */

// ── Config ──
export { config } from './config/index.js';

// ── Types & Schemas (cross-cutting, in types/) ──
export { ConfigSchema } from './types/config.js';
export type { Config } from './types/config.js';

export type { CliArgs } from './types/cli.js';

export type {
  ChunkWindow,
  SegmentAnalyzerOpts,
  SegmentAnalyzerResult,
  SegmentSelectorOpts,
  ClipExporterOpts,
} from './types/pipeline.js';

export type { TranscriptProviderName, AudioProviderName } from './types/factory.js';

// ── Types re-exported from types/ ──
export { TranscriptLineSchema, MicroBlockSchema, LLMChunkSchema } from './types/transcript.js';
export type {
  TranscriptLine,
  MicroBlock,
  LLMChunk,
  TranscriptProvider,
} from './types/transcript.js';

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

export { VideoMetadataSchema } from './types/video.js';
export type { VideoMetadata } from './types/video.js';
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

export {
  TranscriptBundleSchema,
  ClipCandidateSchema,
  ClipPlanSchema,
  CreateAnalysisRequestSchema,
  CreateClipsRequestSchema,
  ClipArtifactSchema,
} from './types/analysis.js';
export type {
  TranscriptBundle,
  ClipCandidate,
  ClipPlan,
  AnalysisOptions,
  CreateAnalysisRequest,
  ClipSelection,
  CreateClipsRequest,
  ClipArtifact,
} from './types/analysis.js';

export type { QaMessage, QaAnswer, QaCitation, QaRequest, QaStreamCallbacks } from './types/qa.js';

export { ClipEditsSchema } from './types/clipEdit.js';
export type { ClipEdits } from './types/clipEdit.js';

export {
  PublishDraftSchema,
  PublishDraftItemSchema,
  UploadArtifactSchema,
  YouTubeAuthStatusSchema,
  YOUTUBE_CATEGORIES,
} from './types/publish.js';
export type {
  PublishDraft,
  PublishDraftItem,
  UploadArtifact,
  YouTubeAuthState,
  YouTubeAuthStatus,
  YouTubeOAuthClientConfig,
  UploadDraftClipsCallbacks,
  GeneratedPublishMetadata,
} from './types/publish.js';

export {
  PlannedWordSchema,
  PlannedSubtitleLineSchema,
  PlanSubtitlesRequestSchema,
  PlanSubtitlesResultSchema,
} from './types/subtitlePlan.js';
export type {
  PlannedWord,
  PlannedSubtitleLine,
  PlanSubtitlesRequest,
  PlanSubtitlesResult,
} from './types/subtitlePlan.js';

// ── Utils ──
export { log } from './utils/logger.js';
export { formatConfig, formatSeconds, sanitizeLogValue } from './utils/format.js';
export { scriptPath, PACKAGE_ROOT, getUserConfigDir } from './utils/paths.js';
export { getPythonBin } from './utils/pythonBin.js';
export { buildWindows } from './utils/chunker.js';
export { createArtifactId } from './utils/ids.js';
export { Model, AudioModel, defineTool } from './services/modelFactory/index.js';

// ── Video Services ──
export {
  parseUrl,
  extractMetadata,
  downloadVideo,
  fetchTranscript,
  fetchAvailableCaptionTracks,
  parseVtt,
  generateClips,
  organizeClips,
  remuxClips,
  configureFfmpeg,
  renderClipWithEdits,
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
  YtDlpTranscriptAnalyzer,
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
  answerQuestion,
  planSubtitles,
  normalizeWordTimings,
  DEFAULT_ANALYSIS_SYSTEM_PROMPT,
  DEFAULT_ANALYSIS_TOOL_SYSTEM_PROMPT,
  DEFAULT_SUBTITLE_PLAN_SYSTEM_PROMPT,
  DEFAULT_QA_SYSTEM_PROMPT,
} from './services/analysis/index.js';

// ── Publish Service ──
export * from './services/publish/index.js';

// ── DB Service (migrations + repos; the sqlite handle stays internal) ──
export * from './services/db/index.js';

// ── Orchestration (transcript / analysis / clips / QA / publish / clip edits) ──
export * from './orchestration/index.js';

// ── Shared Pipeline Stages ──
export { analyzeSegments, refineRankedSegments } from './pipeline/stages/segmentAnalyzer.js';
export { selectSegments } from './pipeline/stages/segmentSelector.js';
export { exportClips } from './pipeline/stages/clipExporter.js';
