import { z } from 'zod';
import type { PublishDraftItem } from '@lib/types/publish.js';

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
} from '@lib/types/publish.js';
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
} from '@lib/types/publish.js';

export interface PublishDraftItemEvent {
  index: number;
  item: PublishDraftItem;
}

export const UploadQueueStatusSchema = z.enum(['queued', 'uploading', 'uploaded', 'failed']);
export type UploadQueueStatus = z.infer<typeof UploadQueueStatusSchema>;

export const ListUploadsQuerySchema = z.object({
  analysisId: z.string().min(1),
});

export const DraftParamsSchema = z.object({
  analysisId: z.string().min(1),
});
