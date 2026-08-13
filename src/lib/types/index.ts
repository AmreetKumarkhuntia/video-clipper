export { ConfigSchema } from './config.js';
export type { Config } from './config.js';
export type {
  ModelFactoryApiKeys,
  SetConfigResult,
  ConfigFieldDescriptor,
  ConfigGroupDescriptor,
  ConfigRegistryResponse,
} from './config.js';

export type {
  ModelOpts,
  ModelGenerateTextOpts,
  ModelStreamTextOpts,
  ModelGenerateJSONOpts,
  ModelStreamJSONOpts,
  AudioModelOpts,
  GenerateSpeechOpts,
  TranscribeOpts,
  DefineToolOpts,
} from './modelFactory.js';

export type { CliArgs } from './cli.js';

export type {
  ChunkWindow,
  SegmentAnalyzerOpts,
  SegmentAnalyzerResult,
  SegmentSelectorOpts,
  ClipExporterOpts,
  ClipExporterConfig,
} from './pipeline.js';

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

export { VideoMetadataSchema } from './video.js';
export type {
  VideoMetadata,
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
  CommandHandler,
  AnalyzeArgs,
  ClipArgs,
  CandidatesArgs,
  LibraryArgs,
  ChannelArgs,
  ConfigArgs,
  AskArgs,
} from './command.js';

export {
  TranscriptBundleSchema,
  ClipCandidateSchema,
  AnalysisOptionsSchema,
  CreateAnalysisRequestSchema,
  ClipPlanSchema,
  ClipSelectionSchema,
  CreateClipsRequestSchema,
  ClipArtifactSchema,
} from './analysis.js';
export type {
  TranscriptBundle,
  ClipCandidate,
  AnalysisOptions,
  CreateAnalysisRequest,
  ClipPlan,
  ClipSelection,
  CreateClipsRequest,
  ClipArtifact,
} from './analysis.js';

export type {
  YtDlpCookies,
  DownloaderConfig,
  AudioDownloadConfig,
  TranscriptChainConfig,
} from './downloader.js';

export {
  QaCitationSchema,
  QaRoleSchema,
  QaMessageSchema,
  QaRequestSchema,
  QaAnswerSchema,
} from './qa.js';
export type {
  QaCitation,
  QaRole,
  QaMessage,
  QaRequest,
  QaAnswer,
  QaStreamCallbacks,
} from './qa.js';

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

export {
  PublishPrivacyStatusSchema,
  PublishLicenseSchema,
  YOUTUBE_CATEGORIES,
  PublishDraftItemSchema,
  PublishDraftSchema,
  SavePublishDraftRequestSchema,
  GeneratePublishMetadataRequestSchema,
  GeneratedPublishMetadataSchema,
  YouTubeChannelSchema,
  YouTubeAuthStateSchema,
  SaveYouTubeManualAuthRequestSchema,
  YouTubeAuthStatusSchema,
  UploadArtifactStatusSchema,
  UploadArtifactSchema,
  CreateUploadsRequestSchema,
  PublishMetadataSchema,
  CachedMetadataSchema,
} from './publish.js';
export type {
  PublishPrivacyStatus,
  PublishLicense,
  PublishDraftItem,
  PublishDraft,
  SavePublishDraftRequest,
  GeneratePublishMetadataRequest,
  GeneratedPublishMetadata,
  YouTubeChannel,
  YouTubeAuthState,
  SaveYouTubeManualAuthRequest,
  YouTubeAuthStatus,
  UploadArtifactStatus,
  UploadArtifact,
  CreateUploadsRequest,
  MetadataGenerationContext,
  OAuthCookieState,
  CachedMetadata,
  YouTubeOAuthClientConfig,
  UploadDraftClipsCallbacks,
} from './publish.js';

export {
  PlannedWordSchema,
  PlannedSubtitleLineSchema,
  PlanSubtitlesResultSchema,
  PlanSubtitlesRequestSchema,
} from './subtitlePlan.js';
export type {
  PlannedWord,
  PlannedSubtitleLine,
  PlanSubtitlesRequest,
  PlanSubtitlesResult,
} from './subtitlePlan.js';
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
