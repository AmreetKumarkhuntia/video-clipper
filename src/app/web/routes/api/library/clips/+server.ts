import type { RequestHandler } from '@sveltejs/kit';
import { config } from '@lib/config/index.js';
import { listClipArtifacts } from '@app/web/lib/services/artifacts/artifactStore.js';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';

export const GET: RequestHandler = async () => {
  try {
    const clips = await listClipArtifacts(config.OUTPUT_DIR);
    return jsonOk({ clips });
  } catch (error) {
    return jsonError(500, 'Failed to list saved clips.', errorMessage(error));
  }
};
