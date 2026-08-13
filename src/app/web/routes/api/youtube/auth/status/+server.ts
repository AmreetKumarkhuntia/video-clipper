import type { RequestHandler } from '@sveltejs/kit';
import { getYouTubeAuthStatus } from '@lib/services/publish/index.js';
import { toYouTubeOAuthConfig } from '@app/web/lib/services/config/webConfig.js';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

export const GET: RequestHandler = async ({ locals }) => {
  const reqDone = log.request('GET', '/api/youtube/auth/status', locals.requestId);

  try {
    const status = await getYouTubeAuthStatus(toYouTubeOAuthConfig(locals.config));
    reqDone(200);
    return jsonOk(status);
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to load YouTube auth status.', errorMessage(error));
  }
};
