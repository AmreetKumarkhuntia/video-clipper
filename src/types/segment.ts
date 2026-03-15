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
});
export type RankedSegment = z.infer<typeof RankedSegmentSchema>;
