import type { RequestHandler } from '@sveltejs/kit';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { clearChunkAnalysis } from '@lib/services/db/repos/chunksRepo.js';
import { clearSegmentations } from '@lib/services/db/repos/segmentationsRepo.js';
import { log } from '@lib/utils/logger.js';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const videoId = params.videoId ?? '';
  const reqDone = log.request('DELETE', `/api/cache/videos/${videoId}/analysis`, locals.requestId);

  if (!videoId) {
    reqDone(400);
    return jsonError(400, 'Missing videoId.');
  }

  try {
    const chunksCleared = clearChunkAnalysis(videoId);
    const segmentationsCleared = clearSegmentations(videoId);
    reqDone(200);
    return jsonOk({ ok: true, chunksCleared, segmentationsCleared });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to clear analysis cache.', errorMessage(error));
  }
};
