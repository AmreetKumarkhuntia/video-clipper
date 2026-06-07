import type { RequestHandler } from '@sveltejs/kit';
import {
  getQaThreadForWeb,
  clearQaThreadForWeb,
} from '@app/web/lib/services/analysis/qaService.js';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

export const GET: RequestHandler = async ({ params, locals }) => {
  const videoId = params.videoId ?? '';
  const reqDone = log.request('GET', '/api/videos/[videoId]/qa', locals.requestId, { videoId });

  if (!videoId) {
    reqDone(400);
    return jsonError(400, 'Missing videoId.');
  }

  try {
    const messages = getQaThreadForWeb(videoId);
    reqDone(200);
    return jsonOk(messages);
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to load Q&A thread.', errorMessage(error));
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const videoId = params.videoId ?? '';
  const reqDone = log.request('DELETE', '/api/videos/[videoId]/qa', locals.requestId, { videoId });

  if (!videoId) {
    reqDone(400);
    return jsonError(400, 'Missing videoId.');
  }

  try {
    const cleared = clearQaThreadForWeb(videoId);
    reqDone(200);
    return jsonOk({ ok: true, cleared });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to clear Q&A thread.', errorMessage(error));
  }
};
