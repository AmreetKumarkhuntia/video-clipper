import { z } from 'zod';

export const PublishPrivacyStatusSchema = z.enum(['private', 'unlisted', 'public']);
export type PublishPrivacyStatus = z.infer<typeof PublishPrivacyStatusSchema>;

export const PublishLicenseSchema = z.enum(['youtube', 'creativeCommon']);
export type PublishLicense = z.infer<typeof PublishLicenseSchema>;

/** YouTube Data API v3 video category IDs with display labels. */
export const YOUTUBE_CATEGORIES: Record<string, string> = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'How-to & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
};

export const PublishDraftItemSchema = z.object({
  clipArtifactId: z.string(),
  segmentId: z.string(),
  filename: z.string(),
  path: z.string(),
  editedPath: z.string().optional(),
  isRenderRequired: z.boolean().default(false),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  durationSec: z.number().positive(),
  transcriptExcerpt: z.string().default(''),
  selected: z.boolean().default(true),
  title: z.string().default(''),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  privacyStatus: PublishPrivacyStatusSchema.default('private'),
  categoryId: z.string().default('22'),
  license: PublishLicenseSchema.default('youtube'),
  selfDeclaredMadeForKids: z.boolean().default(false),
  embeddable: z.boolean().default(true),
  publicStatsViewable: z.boolean().default(true),
  containsSyntheticMedia: z.boolean().default(false),
  isShort: z.boolean().default(false),
  thumbnailPath: z.string().optional(),
  playlistId: z.string().optional(),
  scheduledAt: z.string().optional(),
});
export type PublishDraftItem = z.infer<typeof PublishDraftItemSchema>;

export interface PublishDraftItemEvent {
  index: number;
  item: PublishDraftItem;
}

export const PublishDraftSchema = z.object({
  id: z.string(),
  analysisId: z.string(),
  videoId: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(PublishDraftItemSchema),
});
export type PublishDraft = z.infer<typeof PublishDraftSchema>;

export const SavePublishDraftRequestSchema = z.object({
  analysisId: z.string().min(1),
  videoId: z.string().min(1),
  title: z.string().min(1),
  items: z.array(PublishDraftItemSchema).min(1),
});
export type SavePublishDraftRequest = z.infer<typeof SavePublishDraftRequestSchema>;

export const GeneratePublishMetadataRequestSchema = z.object({
  workflowTitle: z.string().min(1),
  items: z.array(PublishDraftItemSchema).min(1),
  videoDescription: z.string().optional(),
  sourceChannelTitle: z.string().optional(),
});
export type GeneratePublishMetadataRequest = z.infer<typeof GeneratePublishMetadataRequestSchema>;

export const GeneratedPublishMetadataSchema = z.object({
  clipArtifactId: z.string(),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(5000),
  tags: z.array(z.string().min(1).max(30)).max(15),
  categoryId: z.string().min(1).max(5),
});
export type GeneratedPublishMetadata = z.infer<typeof GeneratedPublishMetadataSchema>;

export const YouTubeChannelSchema = z.object({
  channelId: z.string(),
  title: z.string(),
  thumbnailUrl: z.string().url().optional(),
});
export type YouTubeChannel = z.infer<typeof YouTubeChannelSchema>;

export const YouTubeAuthStateSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  expiryDate: z.number().int().positive().optional(),
  scope: z.string().optional(),
  connectedAt: z.string(),
  authMode: z.enum(['manual', 'oauth']).default('manual'),
  channel: YouTubeChannelSchema,
});
export type YouTubeAuthState = z.infer<typeof YouTubeAuthStateSchema>;

export const SaveYouTubeManualAuthRequestSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  expiryDate: z.number().int().positive().optional(),
});
export type SaveYouTubeManualAuthRequest = z.infer<typeof SaveYouTubeManualAuthRequestSchema>;

export const YouTubeAuthStatusSchema = z.object({
  connected: z.boolean(),
  oauthConfigured: z.boolean(),
  channel: YouTubeChannelSchema.optional(),
  connectedAt: z.string().optional(),
  expiresAt: z.number().int().positive().optional(),
  hasRefreshToken: z.boolean().optional(),
  authMode: z.enum(['manual', 'oauth']).optional(),
});
export type YouTubeAuthStatus = z.infer<typeof YouTubeAuthStatusSchema>;

export const UploadArtifactStatusSchema = z.enum(['uploaded', 'failed']);
export type UploadArtifactStatus = z.infer<typeof UploadArtifactStatusSchema>;

export const UploadQueueStatusSchema = z.enum(['queued', 'uploading', 'uploaded', 'failed']);
export type UploadQueueStatus = z.infer<typeof UploadQueueStatusSchema>;

export const UploadArtifactSchema = z.object({
  id: z.string(),
  analysisId: z.string(),
  videoId: z.string(),
  clipArtifactId: z.string(),
  title: z.string(),
  privacyStatus: PublishPrivacyStatusSchema,
  status: UploadArtifactStatusSchema,
  youtubeVideoId: z.string().optional(),
  youtubeUrl: z.string().url().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UploadArtifact = z.infer<typeof UploadArtifactSchema>;

export const CreateUploadsRequestSchema = z.object({
  analysisId: z.string().min(1),
  clipArtifactIds: z.array(z.string().min(1)).optional(),
});
export type CreateUploadsRequest = z.infer<typeof CreateUploadsRequestSchema>;

export interface MetadataGenerationContext {
  videoDescription?: string;
  sourceChannelTitle?: string;
  uploadChannelName?: string;
}

export interface OAuthCookieState {
  state: string;
  codeVerifier: string;
  returnTo: string;
}

export const PublishMetadataSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(5000),
  tags: z.array(z.string().min(1).max(30)).max(15),
  categoryId: z.string().min(1).max(5),
});

export const CachedMetadataSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  categoryId: z.string(),
});
export type CachedMetadata = z.infer<typeof CachedMetadataSchema>;

export const ListUploadsQuerySchema = z.object({
  analysisId: z.string().min(1),
});

export const DraftParamsSchema = z.object({
  analysisId: z.string().min(1),
});
