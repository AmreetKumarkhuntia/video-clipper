import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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
