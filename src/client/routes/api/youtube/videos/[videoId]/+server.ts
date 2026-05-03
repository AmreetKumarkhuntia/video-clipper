import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { createYouTubeCatalogService } from '../../../../../../server/youtube/catalogFactory.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '../../../../../../server/http/responses.js';

const VideoParamsSchema = z.object({
  videoId: z.string().min(1),
});

export const GET: RequestHandler = async ({ params }) => {
  const parsed = VideoParamsSchema.safeParse(params);

  if (!parsed.success) {
    return jsonError(400, 'Invalid video details request.', zodErrorDetail(parsed.error));
  }

  try {
    const catalog = createYouTubeCatalogService();
    const video = await catalog.getVideoDetails(parsed.data.videoId);
    return jsonOk(video);
  } catch (error) {
    return jsonError(500, 'Failed to load YouTube video details.', errorMessage(error));
  }
};
