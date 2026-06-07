import { z } from 'zod';

export const YouTubeThumbnailSchema = z.object({
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type YouTubeThumbnail = z.infer<typeof YouTubeThumbnailSchema>;

export const ChannelSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  handle: z.string().optional(),
  customUrl: z.string().optional(),
  thumbnail: YouTubeThumbnailSchema.optional(),
  uploadsPlaylistId: z.string(),
  subscriberCount: z.number().int().nonnegative().optional(),
  videoCount: z.number().int().nonnegative().optional(),
  viewCount: z.number().int().nonnegative().optional(),
});
export type ChannelSummary = z.infer<typeof ChannelSummarySchema>;

export const VideoSummarySchema = z.object({
  id: z.string(),
  channelId: z.string(),
  channelTitle: z.string(),
  title: z.string(),
  description: z.string(),
  publishedAt: z.string(),
  thumbnail: YouTubeThumbnailSchema.optional(),
  durationSec: z.number().nonnegative(),
  viewCount: z.number().int().nonnegative().optional(),
  likeCount: z.number().int().nonnegative().optional(),
  commentCount: z.number().int().nonnegative().optional(),
  privacyStatus: z.string().optional(),
});
export type VideoSummary = z.infer<typeof VideoSummarySchema>;

export const VideoDetailsSchema = VideoSummarySchema.extend({
  tags: z.array(z.string()).default([]),
  embedHtml: z.string().optional(),
});
export type VideoDetails = z.infer<typeof VideoDetailsSchema>;

export const VideoPageSchema = z.object({
  channelId: z.string(),
  videos: z.array(VideoSummarySchema),
  nextPageToken: z.string().optional(),
  prevPageToken: z.string().optional(),
});
export type VideoPage = z.infer<typeof VideoPageSchema>;

export interface YouTubeCatalogService {
  resolveChannel(input: string): Promise<ChannelSummary>;
  listChannelVideos(channelId: string, pageToken?: string): Promise<VideoPage>;
  getVideoDetails(videoId: string): Promise<VideoDetails>;
}

export type ChannelLookup =
  | { kind: 'id'; value: string }
  | { kind: 'handle'; value: string }
  | { kind: 'username'; value: string };

export interface YtDlpJson {
  title: string;
  duration: number;
}

export interface OEmbedResponse {
  title: string;
}

export interface YouTubeCaptionTrack {
  baseUrl: string;
  kind?: string;
  languageCode: string;
  name?: { simpleText?: string };
}

export interface YouTubePlayerResponse {
  playabilityStatus?: {
    status?: string;
    reason?: string;
    errorScreen?: {
      playerErrorMessageRenderer?: {
        reason?: {
          simpleText?: string;
        };
        subreason?: {
          simpleText?: string;
          runs?: Array<{
            text?: string;
          }>;
        };
      };
    };
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: YouTubeCaptionTrack[];
    };
  };
}
