import type { RequestHandler } from '@sveltejs/kit';
import { listClipArtifacts } from '@app/web/server/artifacts/artifactStore.js';
import { errorMessage, jsonError, jsonOk } from '@app/web/server/http/responses.js';

export const GET: RequestHandler = async () => {
  try {
    const clips = await listClipArtifacts();
    return jsonOk({ clips });
  } catch (error) {
    return jsonError(500, 'Failed to list saved clips.', errorMessage(error));
  }
};
