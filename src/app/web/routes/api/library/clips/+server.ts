import type { RequestHandler } from '@sveltejs/kit';
import { config } from '@lib/config/index.js';
import { listClipArtifacts } from '@app/web/lib/services/artifacts/artifactStore.js';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

export const GET: RequestHandler = async ({ locals }) => {
  const reqDone = log.request('GET', '/api/library/clips', locals.requestId);
  try {
    const clips = await listClipArtifacts(config.OUTPUT_DIR);
    reqDone(200);
    return jsonOk({ clips });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to list saved clips.', errorMessage(error));
  }
};
