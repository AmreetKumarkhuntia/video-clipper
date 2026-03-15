import { z } from 'zod';

export const TranscriptLineSchema = z.object({
  text: z.string(),
  start: z.number(),    // seconds (normalized from offset ms)
  duration: z.number(), // seconds (normalized from duration ms)
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

export const MicroBlockSchema = z.object({
  start: z.number(), // seconds
  end: z.number(),   // seconds
  text: z.string(),
});
export type MicroBlock = z.infer<typeof MicroBlockSchema>;

export const LLMChunkSchema = z.object({
  start: z.number(), // seconds
  end: z.number(),   // seconds
  text: z.string(),
});
export type LLMChunk = z.infer<typeof LLMChunkSchema>;
