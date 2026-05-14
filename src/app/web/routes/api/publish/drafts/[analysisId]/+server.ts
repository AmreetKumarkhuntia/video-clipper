import type { RequestHandler } from '@sveltejs/kit';
import { loadAndRefreshPublishDraft } from '@app/web/lib/services/publishing/draftService.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';
import { DraftParamsSchema } from '@app/web/types/publish.js';

export const GET: RequestHandler = async ({ params, locals }) => {
  const reqDone = log.request('GET', '/api/publish/drafts/[analysisId]', locals.requestId, {
    analysisId: params.analysisId,
  });
  const parsed = DraftParamsSchema.safeParse(params);

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid publish draft request.', zodErrorDetail(parsed.error));
  }

  try {
    const draft = await loadAndRefreshPublishDraft(
      parsed.data.analysisId,
      locals.config,
      locals.requestId,
    );

    if (!draft) {
      reqDone(404);
      return jsonError(404, 'Publish draft could not be created for this analysis yet.');
    }

    reqDone(200);
    return jsonOk({ draft });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to load publish draft.', errorMessage(error));
  }
};
