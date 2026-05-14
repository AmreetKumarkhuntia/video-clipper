import { z } from 'zod';

export const PlannedWordSchema = z.object({
  text: z.string(),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
});

export const PlannedSubtitleLineSchema = z.object({
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  text: z.string(),
  words: z.array(PlannedWordSchema).default([]),
});

export const PlanSubtitlesResultSchema = z.object({
  lines: z.array(PlannedSubtitleLineSchema),
});

export const PlanSubtitlesRequestSchema = z.object({
  durationSec: z.number().positive(),
  subtitles: z.array(PlannedSubtitleLineSchema),
});

export type PlannedWord = z.infer<typeof PlannedWordSchema>;
export type PlannedSubtitleLine = z.infer<typeof PlannedSubtitleLineSchema>;
export type PlanSubtitlesRequest = z.infer<typeof PlanSubtitlesRequestSchema>;
export type PlanSubtitlesResult = z.infer<typeof PlanSubtitlesResultSchema>;
