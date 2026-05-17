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
