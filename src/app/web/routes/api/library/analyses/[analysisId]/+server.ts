import type { RequestHandler } from '@sveltejs/kit';
import { getAnalysis } from '@app/web/lib/services/artifacts/artifactStore.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';
import { AnalysisParamsSchema } from '@app/web/types/analysis.js';

export const GET: RequestHandler = async ({ params, locals }) => {
  const reqDone = log.request('GET', '/api/library/analyses/[analysisId]', locals.requestId, {
    analysisId: params.analysisId,
  });
  const parsed = AnalysisParamsSchema.safeParse(params);

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid analysis lookup request.', zodErrorDetail(parsed.error));
  }

  try {
    const analysis = await getAnalysis(parsed.data.analysisId);

    if (!analysis) {
      reqDone(404);
      return jsonError(404, 'Analysis artifact was not found.');
    }

    reqDone(200);
    return jsonOk(analysis);
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to load saved analysis.', errorMessage(error));
  }
};
