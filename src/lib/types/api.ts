import { z } from 'zod';
import { PositionSchema, TextStyleSchema } from './clipEdit.js';
import type { ConfigRegistryResponse, SetConfigResult } from './config.js';
import type { Customer } from './auth.js';
import type { VideoPage } from './youtube.js';

/**
 * The HTTP contract shared by all three apps.
 *
 * The backend serves these shapes, the web app and the CLI call them. They live
 * in lib rather than in any one app precisely because all three depend on them —
 * a contract owned by one client is not a contract.
 */

// ── Server ───────────────────────────────────────────────────────────────────

/** The slice of config the HTTP layer itself needs, distinct from the domain config. */
export interface ApiServerConfig {
  youtubeApiKey: string | undefined;
  outputDir: string;
  cacheDir: string;
  defaultThreshold: number;
  defaultTopN: number;
  defaultConcurrency: number;
}

// ── Request shapes ───────────────────────────────────────────────────────────

export const ResolveChannelQuerySchema = z.object({
  input: z.string().min(1),
});
export type ResolveChannelQuery = z.infer<typeof ResolveChannelQuerySchema>;

export const ListVideosParamsSchema = z.object({
  channelId: z.string().min(1),
  pageToken: z.string().optional(),
});
export type ListVideosParams = z.infer<typeof ListVideosParamsSchema>;

export const ChannelVideosQuerySchema = z.object({
  pageToken: z.string().optional(),
});
export type ChannelVideosQuery = z.infer<typeof ChannelVideosQuerySchema>;

/**
 * Library paging. Capped at 100 so one call cannot ask the database for an
 * unbounded join, and defaulted so the common call passes nothing.
 */
export const LibraryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
export type LibraryQuery = z.infer<typeof LibraryQuerySchema>;

export const VideoParamsSchema = z.object({
  videoId: z.string().min(1),
});
export type VideoParams = z.infer<typeof VideoParamsSchema>;

export const AnalysisParamsSchema = z.object({
  analysisId: z.string().min(1),
});
export type AnalysisParams = z.infer<typeof AnalysisParamsSchema>;

export const ClipParamsSchema = z.object({
  clipId: z.string().min(1),
});
export type ClipParams = z.infer<typeof ClipParamsSchema>;

export const ListClipsQuerySchema = z.object({
  analysisId: z.string().optional(),
});
export type ListClipsQuery = z.infer<typeof ListClipsQuerySchema>;

/** `edited` 404s when the clip has not been rendered; omitted prefers edited, else original. */
export const ClipFileVariantSchema = z.enum(['original', 'edited']);
export type ClipFileVariant = z.infer<typeof ClipFileVariantSchema>;

export const CreateCaptionPresetSchema = z.object({
  name: z.string().min(1).max(80),
  style: TextStyleSchema,
  position: PositionSchema,
});
export type CreateCaptionPreset = z.infer<typeof CreateCaptionPresetSchema>;

/** Every field optional, so a caller can change one without resending the rest. */
export const UpdateCaptionPresetSchema = CreateCaptionPresetSchema.partial();
export type UpdateCaptionPreset = z.infer<typeof UpdateCaptionPresetSchema>;

/** Operator settings patch: an arbitrary bag of config keys, validated downstream. */
export const SettingsUpdateSchema = z.record(z.string(), z.unknown());
export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;

// ── Response shapes ──────────────────────────────────────────────────────────

/**
 * GET /api/settings: the field registry plus the values the server currently
 * holds. Secret fields arrive as `{ hasValue, masked }` rather than the value,
 * which is why `values` is untyped — the raw secret never leaves the backend.
 */
export interface SettingsResponse {
  registry: ConfigRegistryResponse;
  values: Record<string, unknown>;
}

/** PATCH /api/settings: the write result plus the values the server now holds. */
export interface SettingsUpdateResponse extends SetConfigResult {
  values: Record<string, unknown>;
}

// ── Identity and library responses ───────────────────────────────────────────

/** GET /api/me. The page guard and the topbar both ask this on every load. */
export interface MeResponse {
  customer: Customer;
}

/** GET /api/channel. The one channel this customer is linked to. */
export interface ChannelResponse {
  channelId: string;
  title: string;
  handle?: string;
}

/**
 * GET /api/channel/videos. A page of the customer's uploads, annotated with
 * which are already saved so the grid can show Add against Added without a
 * second round trip per card.
 */
export interface ChannelVideosResponse extends VideoPage {
  savedIds: string[];
}

/** POST and DELETE /api/videos/:videoId. */
export interface LibraryMembershipResponse {
  videoId: string;
  saved: boolean;
}

// ── Server-sent event names ──────────────────────────────────────────────────

export type AnalysisStreamEventName =
  | 'chunk_started'
  | 'chunk_progress'
  | 'chunk_analyzed'
  | 'segment_started'
  | 'segment_progress'
  | 'segment_refined'
  | 'analysis_complete'
  | 'error';

export type QaStreamEventName = 'qa_started' | 'qa_progress' | 'qa_complete' | 'error';

export type UploadStreamEventName =
  | 'upload_started'
  | 'upload_finished'
  | 'upload_failed'
  | 'upload_complete'
  | 'error';

/** The session cookie name. Shared so the backend sets what the frontend forwards. */
export const SESSION_COOKIE_NAME = 'vc_session';

/** The error envelope every backend route returns, and every client reads. */
export interface ApiErrorBody {
  error: { message: string; detail?: string };
}
