import { z } from 'zod';

export const AudioEventSchema = z.object({
  time: z.number(),
  event: z.string(),
  confidence: z.number().min(0).max(1),
  source: z.enum(['gemini', 'yamnet', 'whisper']),
});
export type AudioEvent = z.infer<typeof AudioEventSchema>;

export const MergedCandidateSchema = z.object({
  start: z.number(),
  end: z.number(),
  score: z.number().min(1).max(10),
  source: z.enum(['transcript', 'audio', 'both']),
  reason: z.string(),
  audio_event: z.string().optional(),
});
export type MergedCandidate = z.infer<typeof MergedCandidateSchema>;
