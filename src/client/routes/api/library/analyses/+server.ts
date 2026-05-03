import type { RequestHandler } from '@sveltejs/kit';
import { listAnalyses } from '../../../../../server/artifacts/artifactStore.js';
import { errorMessage, jsonError, jsonOk } from '../../../../../server/http/responses.js';

export const GET: RequestHandler = async () => {
  try {
    const analyses = await listAnalyses();
    return jsonOk({ analyses });
  } catch (error) {
    return jsonError(500, 'Failed to list saved analyses.', errorMessage(error));
  }
};
