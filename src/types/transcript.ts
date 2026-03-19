import { z } from 'zod';

export const TranscriptLineSchema = z.object({
  text: z.string(),
  start: z.number(),
  duration: z.number(),
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

export const MicroBlockSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});
export type MicroBlock = z.infer<typeof MicroBlockSchema>;

export const LLMChunkSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});
export type LLMChunk = z.infer<typeof LLMChunkSchema>;
