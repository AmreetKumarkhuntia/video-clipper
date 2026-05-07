import { z } from 'zod';

export const ListVideosParamsSchema = z.object({
  channelId: z.string().min(1),
  pageToken: z.string().optional(),
});
export type ListVideosParams = z.infer<typeof ListVideosParamsSchema>;

export const ResolveChannelQuerySchema = z.object({
  input: z.string().min(1),
});
export type ResolveChannelQuery = z.infer<typeof ResolveChannelQuerySchema>;

export const VideoParamsSchema = z.object({
  videoId: z.string().min(1),
});
export type VideoParams = z.infer<typeof VideoParamsSchema>;
