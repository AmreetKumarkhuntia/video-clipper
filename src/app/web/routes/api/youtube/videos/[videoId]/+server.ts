import type { RequestHandler } from '@sveltejs/kit';
import { createYouTubeCatalogService } from '@app/web/lib/services/youtube/catalogFactory.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';
import { VideoParamsSchema } from '@app/web/types/youtube.js';
import { upsertChannel } from '@lib/services/db/repos/channelsRepo.js';
import { upsertVideo } from '@lib/services/db/repos/videosRepo.js';

export const GET: RequestHandler = async ({ params, locals }) => {
  const reqDone = log.request('GET', '/api/youtube/videos/[videoId]', locals.requestId, {
    videoId: params.videoId,
  });
  const parsed = VideoParamsSchema.safeParse(params);

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid video details request.', zodErrorDetail(parsed.error));
  }

  try {
    const catalog = createYouTubeCatalogService();
    const video = await catalog.getVideoDetails(parsed.data.videoId);

    try {
      upsertChannel({ id: video.channelId, title: video.channelTitle });
      upsertVideo(video);
    } catch (dbErr) {
      log.warn('videos.[videoId]', 'db upsert failed', locals.requestId, {
        error: errorMessage(dbErr),
      });
    }

    reqDone(200);
    return jsonOk(video);
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to load YouTube video details.', errorMessage(error));
  }
};
