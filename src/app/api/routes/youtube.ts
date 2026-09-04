import { Hono } from 'hono';
import { log } from '@lib/utils/logger.js';
import { upsertChannel, upsertVideo } from '@lib/services/db/index.js';
import {
  ListVideosParamsSchema,
  ResolveChannelQuerySchema,
  VideoParamsSchema,
} from '@lib/types/api.js';
import { createYouTubeCatalogService } from '../services/catalogFactory.js';
import { errorMessage } from '../http/responses.js';
import type { ApiEnv } from '../context.js';

/**
 * Reads that genuinely proxy the YouTube Data API, using the operator's API key.
 *
 * Validation throws and the error middleware turns it into a 400, so these
 * handlers carry none of the per-route try/catch the prototype repeated.
 */
export const youtubeRoutes = new Hono<ApiEnv>();

youtubeRoutes.get('/channels/resolve', async (c) => {
  const { input } = ResolveChannelQuerySchema.parse({ input: c.req.query('input') ?? '' });
  const channel = await createYouTubeCatalogService().resolveChannel(input);
  return c.json(channel);
});

youtubeRoutes.get('/channels/:channelId/videos', async (c) => {
  const { channelId, pageToken } = ListVideosParamsSchema.parse({
    channelId: c.req.param('channelId'),
    pageToken: c.req.query('pageToken') ?? undefined,
  });
  const page = await createYouTubeCatalogService().listChannelVideos(channelId, pageToken);
  return c.json(page);
});

youtubeRoutes.get('/videos/:videoId', async (c) => {
  const { videoId } = VideoParamsSchema.parse({ videoId: c.req.param('videoId') });
  const video = await createYouTubeCatalogService().getVideoDetails(videoId);

  // Write-through so the catalog row exists for anything that later references
  // this video. A failure here must not fail the read.
  try {
    upsertChannel({ id: video.channelId, title: video.channelTitle });
    upsertVideo(video);
  } catch (error) {
    log.warn('api.youtube', 'catalog write-through failed', c.get('requestId'), {
      videoId,
      error: errorMessage(error),
    });
  }

  return c.json(video);
});
