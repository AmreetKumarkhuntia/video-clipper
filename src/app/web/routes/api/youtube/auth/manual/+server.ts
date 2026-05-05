import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { saveManualYouTubeAuth } from '@app/web/lib/services/youtube/uploadAuth.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  parseJsonBody,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { SaveYouTubeManualAuthRequestSchema } from '@app/web/types/publish.js';
import { log } from '@lib/utils/logger.js';

export const POST: RequestHandler = async (event) => {
  const reqDone = log.request('POST', '/api/youtube/auth/manual', event.locals.requestId);

  try {
    const input = await parseJsonBody(event, SaveYouTubeManualAuthRequestSchema);
    const status = await saveManualYouTubeAuth(input);
    reqDone(200);
    return jsonOk(status);
  } catch (error) {
    if (error instanceof z.ZodError) {
      reqDone(400);
      return jsonError(400, 'Invalid YouTube auth request.', zodErrorDetail(error));
    }

    reqDone(500);
    return jsonError(500, 'Failed to save YouTube auth.', errorMessage(error));
  }
};
