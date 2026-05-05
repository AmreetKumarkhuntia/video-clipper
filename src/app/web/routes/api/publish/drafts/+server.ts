import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { savePublishDraftFromRequest } from '@app/web/lib/services/publishing/draftService.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  parseJsonBody,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { SavePublishDraftRequestSchema } from '@app/web/types/publish.js';
import { log } from '@lib/utils/logger.js';

export const POST: RequestHandler = async (event) => {
  const reqDone = log.request('POST', '/api/publish/drafts', event.locals.requestId);

  try {
    const input = await parseJsonBody(event, SavePublishDraftRequestSchema);
    const draft = await savePublishDraftFromRequest(
      input,
      event.locals.config,
      event.locals.requestId,
    );
    reqDone(200);
    return jsonOk({ draft });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reqDone(400);
      return jsonError(400, 'Invalid publish draft request.', zodErrorDetail(error));
    }

    reqDone(500);
    return jsonError(500, 'Failed to save publish draft.', errorMessage(error));
  }
};
