import type { RequestHandler } from '@sveltejs/kit';
import { listAnalyses } from '@app/web/lib/services/artifacts/artifactStore.js';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

export const GET: RequestHandler = async ({ locals }) => {
  const reqDone = log.request('GET', '/api/library/analyses', locals.requestId);
  try {
    const analyses = await listAnalyses();
    reqDone(200);
    return jsonOk({ analyses });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to list saved analyses.', errorMessage(error));
  }
};
