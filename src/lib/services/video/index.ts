export type { VideoSource } from '@lib/types/video.js';
export { parseUrl } from './source/youtube/parser.js';
export { extractMetadata } from './source/youtube/metadata.js';
export { downloadVideo } from './source/youtube/downloader.js';
export {
  parseVtt,
  fetchTranscript,
  fetchAvailableCaptionTracks,
} from './source/youtube/subtitles.js';
export {
  GoogleYouTubeCatalogService,
  parseChannelInput,
  parseYouTubeDuration,
} from './source/youtube/catalog.js';
export type { YouTubeCatalogService } from '@lib/types/youtube.js';
export { generateClips, organizeClips, remuxClips, configureFfmpeg } from './clipper/index.js';
export { renderClipWithEdits } from './clipper/editor/renderer.js';
export { VideoMetadataSchema } from '@lib/types/video.js';
export type {
  VideoMetadata,
  DownloadMode,
  DownloadResultAll,
  DownloadResultSegments,
  DownloadResult,
} from '@lib/types/video.js';
export {
  ChannelSummarySchema,
  VideoSummarySchema,
  VideoDetailsSchema,
  VideoPageSchema,
  YouTubeThumbnailSchema,
} from '@lib/types/youtube.js';
export type {
  ChannelSummary,
  VideoSummary,
  VideoDetails,
  VideoPage,
  YouTubeThumbnail,
} from '@lib/types/youtube.js';
