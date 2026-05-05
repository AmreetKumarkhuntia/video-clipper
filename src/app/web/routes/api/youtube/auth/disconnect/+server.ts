import type { RequestHandler } from '@sveltejs/kit';
import { disconnectYouTubeAuth } from '@app/web/lib/services/youtube/uploadAuth.js';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

export const POST: RequestHandler = async ({ locals }) => {
  const reqDone = log.request('POST', '/api/youtube/auth/disconnect', locals.requestId);

  try {
    await disconnectYouTubeAuth();
    reqDone(200);
    return jsonOk({ success: true });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to disconnect YouTube auth.', errorMessage(error));
  }
};
