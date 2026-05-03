import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { createYouTubeCatalogService } from '@app/web/server/youtube/catalogFactory.js';
import { errorMessage, jsonError, jsonOk, zodErrorDetail } from '@app/web/server/http/responses.js';

const ListVideosParamsSchema = z.object({
  channelId: z.string().min(1),
  pageToken: z.string().optional(),
});

export const GET: RequestHandler = async ({ params, url }) => {
  const parsed = ListVideosParamsSchema.safeParse({
    channelId: params.channelId,
    pageToken: url.searchParams.get('pageToken') ?? undefined,
  });

  if (!parsed.success) {
    return jsonError(400, 'Invalid channel videos request.', zodErrorDetail(parsed.error));
  }

  try {
    const catalog = createYouTubeCatalogService();
    const page = await catalog.listChannelVideos(parsed.data.channelId, parsed.data.pageToken);
    return jsonOk(page);
  } catch (error) {
    return jsonError(500, 'Failed to list YouTube channel videos.', errorMessage(error));
  }
};
