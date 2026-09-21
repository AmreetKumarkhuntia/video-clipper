import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  type PgTimestampBuilderInitial,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const timestampWithTimezone = <TName extends string>(
  name: TName,
): PgTimestampBuilderInitial<TName> =>
  timestamp(name, { precision: 3, withTimezone: true, mode: 'date' });

// Stable channel identity only — dynamic stats fetched from YouTube API on demand.
export const channels = pgTable('channels', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  handle: text('handle'),
  createdAt: timestampWithTimezone('created_at').notNull(),
  updatedAt: timestampWithTimezone('updated_at').notNull(),
});

// Stable video metadata + inline transcript (1:1). Dynamic stats are fetched on demand.
export const videos = pgTable('videos', {
  id: text('id').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  channelTitle: text('channel_title').notNull().default(''),
  publishedAt: timestampWithTimezone('published_at'),
  durationSec: doublePrecision('duration_sec').notNull().default(0),
  tags: jsonb('tags').notNull().default([]),
  thumbnailUrl: text('thumbnail_url'),
  transcriptLines: jsonb('transcript_lines'),
  transcriptFetchedAt: timestampWithTimezone('transcript_fetched_at'),
  createdAt: timestampWithTimezone('created_at').notNull(),
  updatedAt: timestampWithTimezone('updated_at').notNull(),
});

// One row per transcript chunk per video. Populated during analysis.
export const chunks = pgTable(
  'chunks',
  {
    id: text('id').primaryKey(),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    chunk: jsonb('chunk').notNull(),
    analysis: jsonb('analysis'),
    score: doublePrecision('score'),
    start: doublePrecision('start').notNull(),
    end: doublePrecision('end').notNull(),
    rank: integer('rank'),
    createdAt: timestampWithTimezone('created_at').notNull(),
    updatedAt: timestampWithTimezone('updated_at').notNull(),
  },
  (table) => [index('chunks_video_range_idx').on(table.videoId, table.start, table.end)],
);

// One row per ranked segment per video and options fingerprint.
export const segmentations = pgTable(
  'segmentations',
  {
    id: text('id').primaryKey(),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    rank: integer('rank').notNull(),
    startSec: doublePrecision('start_sec').notNull(),
    endSec: doublePrecision('end_sec').notNull(),
    score: doublePrecision('score').notNull(),
    reason: text('reason').notNull(),
    source: text('source').notNull(),
    audioEvent: text('audio_event'),
    optionsHash: text('options_hash').notNull(),
    completed: boolean('completed').notNull().default(false),
    createdAt: timestampWithTimezone('created_at').notNull(),
    updatedAt: timestampWithTimezone('updated_at').notNull(),
  },
  (table) => [
    index('segmentations_cache_idx').on(
      table.videoId,
      table.optionsHash,
      table.completed,
      table.rank,
    ),
  ],
);

// One row per completed analysis. Candidates are reconstructed from related rows.
export const analyses = pgTable(
  'analyses',
  {
    id: text('id').primaryKey(),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    title: text('title').notNull(),
    durationSec: doublePrecision('duration_sec').notNull(),
    optionsHash: text('options_hash').notNull(),
    createdAt: timestampWithTimezone('created_at').notNull(),
    updatedAt: timestampWithTimezone('updated_at').notNull(),
  },
  (table) => [
    index('analyses_video_created_idx').on(table.videoId, table.createdAt),
    index('analyses_created_at_idx').on(table.createdAt),
  ],
);

// One publish draft per analysis.
export const publishDrafts = pgTable('publish_drafts', {
  id: text('id').primaryKey(),
  analysisId: text('analysis_id')
    .notNull()
    .unique()
    .references(() => analyses.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  title: text('title').notNull(),
  itemsJson: jsonb('items_json').notNull(),
  createdAt: timestampWithTimezone('created_at').notNull(),
  updatedAt: timestampWithTimezone('updated_at').notNull(),
});

// Upload attempts are audit records. clipArtifactId deliberately has no FK to clips.
export const uploadArtifacts = pgTable(
  'upload_artifacts',
  {
    id: text('id').primaryKey(),
    analysisId: text('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    clipArtifactId: text('clip_artifact_id').notNull(),
    title: text('title').notNull(),
    privacyStatus: text('privacy_status').notNull(),
    status: text('status').notNull(),
    youtubeVideoId: text('youtube_video_id'),
    youtubeUrl: text('youtube_url'),
    error: text('error'),
    createdAt: timestampWithTimezone('created_at').notNull(),
    updatedAt: timestampWithTimezone('updated_at').notNull(),
  },
  (table) => [index('upload_artifacts_analysis_id_idx').on(table.analysisId)],
);

export const captionPresets = pgTable('caption_presets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  style: jsonb('style').notNull(),
  position: jsonb('position').notNull(),
  createdAt: timestampWithTimezone('created_at').notNull(),
  updatedAt: timestampWithTimezone('updated_at').notNull(),
});

export const qaMessages = pgTable(
  'qa_messages',
  {
    id: text('id').primaryKey(),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    citations: jsonb('citations').notNull().default([]),
    createdAt: timestampWithTimezone('created_at').notNull(),
  },
  (table) => [index('qa_messages_video_created_idx').on(table.videoId, table.createdAt)],
);

// Roles precede customers so the authorization FK is part of the baseline schema.
export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  rank: integer('rank').notNull(),
  permissions: jsonb('permissions').notNull().default([]),
  createdAt: timestampWithTimezone('created_at').notNull(),
  updatedAt: timestampWithTimezone('updated_at').notNull(),
});

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  email: text('email'),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  roleId: text('role_id')
    .notNull()
    .default('customer')
    .references(() => roles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  createdAt: timestampWithTimezone('created_at').notNull(),
  updatedAt: timestampWithTimezone('updated_at').notNull(),
});

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiryDate: timestampWithTimezone('expiry_date'),
    scope: text('scope'),
    channelId: text('channel_id').references(() => channels.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestampWithTimezone('created_at').notNull(),
    updatedAt: timestampWithTimezone('updated_at').notNull(),
  },
  (table) => [
    index('auth_identities_customer_id_idx').on(table.customerId),
    index('auth_identities_channel_id_idx').on(table.channelId),
    uniqueIndex('auth_identities_provider_account_uq').on(table.provider, table.providerAccountId),
    uniqueIndex('auth_identities_provider_channel_uq')
      .on(table.provider, table.channelId)
      .where(sql`${table.channelId} is not null`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    expiresAt: timestampWithTimezone('expires_at').notNull(),
    createdAt: timestampWithTimezone('created_at').notNull(),
  },
  (table) => [
    index('sessions_customer_id_idx').on(table.customerId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const libraryVideos = pgTable(
  'library_videos',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    savedAt: timestampWithTimezone('saved_at').notNull(),
    createdAt: timestampWithTimezone('created_at').notNull(),
    updatedAt: timestampWithTimezone('updated_at').notNull(),
  },
  (table) => [
    index('library_videos_customer_saved_idx').on(table.customerId, table.savedAt),
    uniqueIndex('library_videos_customer_video_uq').on(table.customerId, table.videoId),
  ],
);

// segmentationId remains nullable so re-segmentation can preserve a generated clip.
export const clips = pgTable(
  'clips',
  {
    id: text('id').primaryKey(),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    analysisId: text('analysis_id').references(() => analyses.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    segmentationId: text('segmentation_id').references(() => segmentations.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    segmentRank: integer('segment_rank').notNull(),
    filename: text('filename').notNull(),
    path: text('path').notNull(),
    editedPath: text('edited_path'),
    editsJson: jsonb('edits_json'),
    currentEditsHash: text('current_edits_hash'),
    lastRenderedHash: text('last_rendered_hash'),
    startSec: doublePrecision('start_sec').notNull(),
    endSec: doublePrecision('end_sec').notNull(),
    durationSec: doublePrecision('duration_sec').notNull(),
    createdAt: timestampWithTimezone('created_at').notNull(),
    updatedAt: timestampWithTimezone('updated_at').notNull(),
  },
  (table) => [
    index('clips_analysis_id_idx').on(table.analysisId),
    index('clips_video_id_idx').on(table.videoId),
  ],
);
