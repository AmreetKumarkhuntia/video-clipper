import type { RequestHandler } from '@sveltejs/kit';
import { listAnalyses } from '@app/web/server/artifacts/artifactStore.js';
import { errorMessage, jsonError, jsonOk } from '@app/web/server/http/responses.js';

export const GET: RequestHandler = async () => {
  try {
    const analyses = await listAnalyses();
    return jsonOk({ analyses });
  } catch (error) {
    return jsonError(500, 'Failed to list saved analyses.', errorMessage(error));
  }
};
