import { z } from 'zod';
import { RankedSegmentSchema } from './segment.js';

export const VideoMetadataSchema = z.object({
  videoId: z.string().length(11),
  title: z.string(),
  duration: z.number(), // seconds
});
export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

export const PipelineResultSchema = z.object({
  video_id: z.string().length(11),
  title: z.string(),
  duration: z.number(), // seconds
  segments: z.array(RankedSegmentSchema),
});
export type PipelineResult = z.infer<typeof PipelineResultSchema>;
