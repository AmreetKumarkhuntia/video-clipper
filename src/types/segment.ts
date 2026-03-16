import { z } from 'zod';

export const AnalyzedSegmentSchema = z.object({
  interesting: z.boolean(),
  score: z.number().min(1).max(10),
  reason: z.string(),
  clip_start: z.number(), // seconds
  clip_end: z.number(), // seconds
});
export type AnalyzedSegment = z.infer<typeof AnalyzedSegmentSchema>;

export const RankedSegmentSchema = z.object({
  rank: z.number().int().min(1),
  start: z.number(), // seconds
  end: z.number(), // seconds
  score: z.number().min(1).max(10),
  reason: z.string(),
  source: z.enum(['transcript', 'audio', 'both']),
  audio_event: z.string().optional(),
});
export type RankedSegment = z.infer<typeof RankedSegmentSchema>;

const ChunkEvaluationBaseSchema = z.object({
  chunk_index: z.number().int().min(0),
  chunk_start: z.number(), // seconds
  chunk_end: z.number(), // seconds
});

export const ChunkEvaluationSchema = z.discriminatedUnion('status', [
  ChunkEvaluationBaseSchema.extend({
    status: z.literal('success'),
    interesting: z.boolean(),
    score: z.number().min(1).max(10),
    reason: z.string(),
    clip_start: z.number(),
    clip_end: z.number(),
  }),
  ChunkEvaluationBaseSchema.extend({
    status: z.literal('failed'),
    error: z.string(),
  }),
]);
export type ChunkEvaluation = z.infer<typeof ChunkEvaluationSchema>;
