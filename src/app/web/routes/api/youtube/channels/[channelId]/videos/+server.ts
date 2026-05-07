import type { RequestHandler } from '@sveltejs/kit';
import { createYouTubeCatalogService } from '@app/web/lib/services/youtube/catalogFactory.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';
import { ListVideosParamsSchema } from '@app/web/types/youtube.js';

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const reqDone = log.request('GET', '/api/youtube/channels/[channelId]/videos', locals.requestId, {
    channelId: params.channelId,
  });
  const parsed = ListVideosParamsSchema.safeParse({
    channelId: params.channelId,
    pageToken: url.searchParams.get('pageToken') ?? undefined,
  });

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid channel videos request.', zodErrorDetail(parsed.error));
  }

  try {
    const catalog = createYouTubeCatalogService();
    const page = await catalog.listChannelVideos(parsed.data.channelId, parsed.data.pageToken);
    reqDone(200);
    return jsonOk(page);
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to list YouTube channel videos.', errorMessage(error));
  }
};
