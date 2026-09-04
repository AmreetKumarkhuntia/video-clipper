import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Stable channel identity only — dynamic stats fetched from YouTube API on demand
export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  handle: text('handle'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Stable video metadata + inline transcript (1:1). Dynamic stats fetched on demand.
export const videos = sqliteTable('videos', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  channelTitle: text('channel_title').notNull().default(''),
  publishedAt: text('published_at').notNull().default(''),
  durationSec: real('duration_sec').notNull().default(0),
  tags: text('tags').notNull().default('[]'), // JSON: string[]
  thumbnailUrl: text('thumbnail_url'), // best available YouTube thumbnail | null
  transcriptLines: text('transcript_lines'), // JSON: TranscriptLine[] | null
  transcriptFetchedAt: text('transcript_fetched_at'), // ISO timestamp | null
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// One row per chunk per video. Populated during analysis (Phase 2+).
export const chunks = sqliteTable('chunks', {
  id: text('id').primaryKey(), // nanoid
  videoId: text('video_id').notNull(),
  chunk: text('chunk').notNull(), // JSON: { start, end, text }
  analysis: text('analysis'), // JSON: ChunkEvaluation | null
  score: real('score'), // denorm from analysis for filtering
  start: real('start').notNull(), // denorm from chunk for ordering
  end: real('end').notNull(),
  rank: integer('rank'), // set when chunk becomes a candidate
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// One row per ranked segment per video per options fingerprint.
// Caches the output of selectSegments + refineRankedSegments.
// Invalidated when chunk analysis is re-run or noCache=true.
// completed=0 while refinement is in progress; set to 1 only after all segments are written.
// findSegmentations filters to completed=1 so partial/aborted batches are never served as cache hits.
export const segmentations = sqliteTable('segmentations', {
  id: text('id').primaryKey(), // nanoid
  videoId: text('video_id').notNull(),
  rank: integer('rank').notNull(),
  startSec: real('start_sec').notNull(),
  endSec: real('end_sec').notNull(),
  score: real('score').notNull(),
  reason: text('reason').notNull(),
  source: text('source').notNull(), // 'transcript' | 'audio' | 'both'
  audioEvent: text('audio_event'), // optional
  optionsHash: text('options_hash').notNull(), // stable JSON key of {threshold,topN,refine,maxChunks}
  completed: integer('completed').notNull().default(0), // 0 = in-progress, 1 = batch complete
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// One row per completed analysis. Lean metadata only — candidates and chunkEvaluations
// are reconstructed at read time from the segmentations and chunks tables.
// optionsHash links to the correct segmentation batch for this analysis.
export const analyses = sqliteTable('analyses', {
  id: text('id').primaryKey(), // analysisId e.g. 'analysis-videoId-ts-uuid8'
  videoId: text('video_id').notNull(),
  title: text('title').notNull(),
  durationSec: real('duration_sec').notNull(),
  optionsHash: text('options_hash').notNull(), // links to segmentations batch
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// One row per analysis's publish draft. Items serialised as JSON; one draft per analysis (UNIQUE on analysis_id).
export const publishDrafts = sqliteTable('publish_drafts', {
  id: text('id').primaryKey(),
  analysisId: text('analysis_id').notNull().unique(),
  videoId: text('video_id').notNull(),
  title: text('title').notNull(),
  itemsJson: text('items_json').notNull(), // JSON: PublishDraftItem[]
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// One row per upload attempt. Indexed by analysisId for bulk listing.
export const uploadArtifacts = sqliteTable(
  'upload_artifacts',
  {
    id: text('id').primaryKey(),
    analysisId: text('analysis_id').notNull(),
    videoId: text('video_id').notNull(),
    clipArtifactId: text('clip_artifact_id').notNull(),
    title: text('title').notNull(),
    privacyStatus: text('privacy_status').notNull(),
    status: text('status').notNull(), // 'uploaded' | 'failed'
    youtubeVideoId: text('youtube_video_id'),
    youtubeUrl: text('youtube_url'),
    error: text('error'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('upload_artifacts_analysis_id_idx').on(t.analysisId)],
);

// User-defined caption style presets. Global — available across all clips and videos.
// style and position are stored as JSON blobs matching TextStyle and Position from clipEdit.ts.
export const captionPresets = sqliteTable('caption_presets', {
  id: text('id').primaryKey(), // nanoid
  name: text('name').notNull(),
  style: text('style').notNull(), // JSON: TextStyle
  position: text('position').notNull(), // JSON: Position
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// One row per Q&A message per video. Persists the multi-turn chat history for ask-about-video.
export const qaMessages = sqliteTable(
  'qa_messages',
  {
    id: text('id').primaryKey(), // nanoid / uuid
    videoId: text('video_id').notNull(),
    role: text('role').notNull(), // 'user' | 'assistant'
    content: text('content').notNull(),
    citations: text('citations').notNull().default('[]'), // JSON: QaCitation[]
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('qa_messages_video_id_idx').on(t.videoId)],
);
// this table is the source of truth for clip metadata, edits payload, and render-path bookkeeping.
// segmentationId is nullable so a clip remains queryable after its source segmentation row is
// replaced (segmentations get delete-then-inserted on re-runs). segmentRank is denormalised for
// matching back to a fresh segmentation row by (videoId, rank).
export const clips = sqliteTable('clips', {
  id: text('id').primaryKey(), // clip-<videoId>-<segmentId>
  videoId: text('video_id').notNull(),
  analysisId: text('analysis_id'), // denorm from generation request; null if generated outside an analysis flow
  segmentationId: text('segmentation_id'), // FK to segmentations.id, nullable on re-segmentation
  segmentRank: integer('segment_rank').notNull(),
  filename: text('filename').notNull(),
  path: text('path').notNull(), // absolute path to source mp4 on disk
  editedPath: text('edited_path'), // absolute path to rendered _edited.mp4 if present
  editsJson: text('edits_json'), // JSON of ClipEdits (clipId stripped); null until first save
  currentEditsHash: text('current_edits_hash'),
  lastRenderedHash: text('last_rendered_hash'),
  startSec: real('start_sec').notNull(),
  endSec: real('end_sec').notNull(),
  durationSec: real('duration_sec').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Who someone is, and nothing else. No auth columns, and no `channel_id`:
// a channel belongs to a provider account, not to a person, and a provider we
// add later may have no such concept at all. Everything provider-shaped lives
// on auth_identities.
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  email: text('email'), // display and contact only — never an identity key
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// How someone signs in, and what that sign-in gave us. One row per linked login,
// so a customer can hold several.
//
// `provider` is the type — 'google' today, 'twitch' tomorrow — and is a value,
// not a schema decision. `provider_account_id` is the provider's own stable id
// (Google's `sub`), used rather than email because an email can change hands,
// which would silently move someone's library to a stranger.
//
// The tokens live here rather than in a youtube_auth table so that adding a
// provider needs no new table. `channel_id` is the creator account on that
// provider — a YouTube channel, a Twitch channel — and is a column rather than
// a metadata key only because the claimed-channel check queries it on every
// sign-in. Anything else provider-specific goes in `metadata`.
export const authIdentities = sqliteTable(
  'auth_identities',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'), // issued only on first consent — never overwrite with null
    expiryDate: integer('expiry_date'),
    scope: text('scope'),
    channelId: text('channel_id'), // null when the provider has no channel concept
    metadata: text('metadata').notNull().default('{}'), // JSON: provider-specific extras
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('auth_identities_customer_id_idx').on(t.customerId),
    index('auth_identities_channel_id_idx').on(t.channelId),
    uniqueIndex('auth_identities_provider_account_uq').on(t.provider, t.providerAccountId),
  ],
);

// Login sessions. `id` is sha256(token) — the raw token lives only in the cookie and is never stored.
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id').notNull(),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('sessions_customer_id_idx').on(t.customerId)],
);

// youtube_auth is gone: per-provider tokens are columns on auth_identities now,
// so a second provider needs no second table. The publish flow's single-file
// store is a different thing and is untouched.

// A customer's claim on a video. Ownership lives here, never as a column on the shared `videos` catalog,
// which is keyed by YouTube video id and written by the CLI too.
export const libraryVideos = sqliteTable(
  'library_videos',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id').notNull(),
    videoId: text('video_id').notNull(),
    savedAt: integer('saved_at').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('library_videos_customer_saved_idx').on(t.customerId, t.savedAt),
    uniqueIndex('library_videos_customer_video_uq').on(t.customerId, t.videoId),
  ],
);
