import { youtube } from '@googleapis/youtube';
import type { youtube_v3 } from '@googleapis/youtube';
import {
  ChannelSummarySchema,
  VideoDetailsSchema,
  VideoPageSchema,
  VideoSummarySchema,
} from '@lib/types/youtube.js';
import type {
  ChannelSummary,
  VideoDetails,
  VideoPage,
  VideoSummary,
  YouTubeCatalogService,
  ChannelLookup,
} from '@lib/types/youtube.js';

export class GoogleYouTubeCatalogService implements YouTubeCatalogService {
  private readonly client: youtube_v3.Youtube;

  constructor(apiKey: string) {
    this.client = youtube({ version: 'v3', auth: apiKey });
  }

  async resolveChannel(input: string): Promise<ChannelSummary> {
    const lookup = parseChannelInput(input);
    const request = {
      part: ['snippet', 'contentDetails', 'statistics'],
      maxResults: 1,
      ...(lookup.kind === 'id' ? { id: [lookup.value] } : {}),
      ...(lookup.kind === 'handle' ? { forHandle: lookup.value } : {}),
      ...(lookup.kind === 'username' ? { forUsername: lookup.value } : {}),
    };

    const response = await this.client.channels.list(request);
    const item = response.data.items?.[0];
    if (!item) {
      throw new Error(`No YouTube channel found for "${input}".`);
    }

    return mapChannel(item);
  }

  async listChannelVideos(channelId: string, pageToken?: string): Promise<VideoPage> {
    const channel = await this.resolveChannel(channelId);
    const playlistResponse = await this.client.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: channel.uploadsPlaylistId,
      maxResults: 24,
      pageToken,
    });

    const videoIds =
      playlistResponse.data.items
        ?.map((item) => item.contentDetails?.videoId)
        .filter((id): id is string => Boolean(id)) ?? [];

    if (videoIds.length === 0) {
      return VideoPageSchema.parse({
        channelId,
        videos: [],
        nextPageToken: playlistResponse.data.nextPageToken ?? undefined,
        prevPageToken: playlistResponse.data.prevPageToken ?? undefined,
      });
    }

    const videos = await this.getVideoSummaries(videoIds);
    return VideoPageSchema.parse({
      channelId,
      videos,
      nextPageToken: playlistResponse.data.nextPageToken ?? undefined,
      prevPageToken: playlistResponse.data.prevPageToken ?? undefined,
    });
  }

  async getVideoDetails(videoId: string): Promise<VideoDetails> {
    const response = await this.client.videos.list({
      part: ['snippet', 'contentDetails', 'statistics', 'status', 'player'],
      id: [videoId],
      maxResults: 1,
    });

    const item = response.data.items?.[0];
    if (!item) {
      throw new Error(`No YouTube video found for "${videoId}".`);
    }

    return mapVideoDetails(item);
  }

  private async getVideoSummaries(videoIds: string[]): Promise<VideoSummary[]> {
    const response = await this.client.videos.list({
      part: ['snippet', 'contentDetails', 'statistics', 'status'],
      id: videoIds,
      maxResults: videoIds.length,
    });

    return (response.data.items ?? []).map(mapVideoSummary);
  }
}

export function parseChannelInput(input: string): ChannelLookup {
  const normalized = input.trim();
  if (normalized === '') {
    throw new Error('Channel input is required.');
  }

  const url = tryParseUrl(normalized);
  if (url) {
    const parts = url.pathname.split('/').filter(Boolean);
    const first = parts[0];
    const second = parts[1];

    if (first === 'channel' && second) return { kind: 'id', value: second };
    if (first === 'user' && second) return { kind: 'username', value: second };
    if (first?.startsWith('@')) return { kind: 'handle', value: first };
  }

  if (normalized.startsWith('@')) return { kind: 'handle', value: normalized };
  if (/^UC[a-zA-Z0-9_-]{20,}$/.test(normalized)) return { kind: 'id', value: normalized };

  return { kind: 'handle', value: normalized };
}

export function parseYouTubeDuration(duration: string | null | undefined): number {
  if (!duration) return 0;

  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(duration);
  if (!match) return 0;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function tryParseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function mapChannel(item: youtube_v3.Schema$Channel): ChannelSummary {
  const uploadsPlaylistId = item.contentDetails?.relatedPlaylists?.uploads;
  if (!item.id || !uploadsPlaylistId) {
    throw new Error('YouTube channel response did not include an id or uploads playlist.');
  }

  return ChannelSummarySchema.parse({
    id: item.id,
    title: item.snippet?.title ?? 'Untitled channel',
    description: item.snippet?.description ?? '',
    handle: item.snippet?.customUrl?.startsWith('@') ? item.snippet.customUrl : undefined,
    customUrl: item.snippet?.customUrl ?? undefined,
    thumbnail: mapThumbnail(item.snippet?.thumbnails),
    uploadsPlaylistId,
    subscriberCount: parseOptionalInt(item.statistics?.subscriberCount),
    videoCount: parseOptionalInt(item.statistics?.videoCount),
    viewCount: parseOptionalInt(item.statistics?.viewCount),
  });
}

function mapVideoSummary(item: youtube_v3.Schema$Video): VideoSummary {
  return VideoSummarySchema.parse({
    id: item.id ?? '',
    channelId: item.snippet?.channelId ?? '',
    channelTitle: item.snippet?.channelTitle ?? '',
    title: item.snippet?.title ?? 'Untitled video',
    description: item.snippet?.description ?? '',
    publishedAt: item.snippet?.publishedAt ?? '',
    thumbnail: mapThumbnail(item.snippet?.thumbnails),
    durationSec: parseYouTubeDuration(item.contentDetails?.duration),
    viewCount: parseOptionalInt(item.statistics?.viewCount),
    likeCount: parseOptionalInt(item.statistics?.likeCount),
    commentCount: parseOptionalInt(item.statistics?.commentCount),
    privacyStatus: item.status?.privacyStatus ?? undefined,
  });
}

function mapVideoDetails(item: youtube_v3.Schema$Video): VideoDetails {
  const summary = mapVideoSummary(item);
  return VideoDetailsSchema.parse({
    ...summary,
    tags: item.snippet?.tags ?? [],
    embedHtml: item.player?.embedHtml ?? undefined,
  });
}

function mapThumbnail(
  thumbnails: youtube_v3.Schema$ThumbnailDetails | undefined,
): { url: string; width?: number; height?: number } | undefined {
  const selected =
    thumbnails?.maxres ??
    thumbnails?.standard ??
    thumbnails?.high ??
    thumbnails?.medium ??
    thumbnails?.default;

  if (!selected?.url) return undefined;

  return {
    url: selected.url,
    width: selected.width ?? undefined,
    height: selected.height ?? undefined,
  };
}

function parseOptionalInt(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
