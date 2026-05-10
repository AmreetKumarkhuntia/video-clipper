import type { RequestHandler } from '@sveltejs/kit';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { clearVideoTranscriptCache } from '@lib/services/cache/manifest.js';
import { log } from '@lib/utils/logger.js';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const videoId = params.videoId ?? '';
  const reqDone = log.request(
    'DELETE',
    `/api/cache/videos/${videoId}/transcript`,
    locals.requestId,
  );

  if (!videoId) {
    reqDone(400);
    return jsonError(400, 'Missing videoId.');
  }

  try {
    const result = await clearVideoTranscriptCache(locals.config.CACHE_DIR, videoId);
    reqDone(200);
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to clear transcript cache.', errorMessage(error));
  }
};
