import type { RequestHandler } from '@sveltejs/kit';
import { listClips, listClipsByAnalysisId } from '@lib/services/db/repos/clipsRepo.js';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';
import { ListClipsQuerySchema } from '@app/web/types/analysis.js';

export const GET: RequestHandler = async ({ locals, url }) => {
  const reqDone = log.request('GET', '/api/library/clips', locals.requestId);

  const parsed = ListClipsQuerySchema.safeParse({
    analysisId: url.searchParams.get('analysisId') ?? undefined,
  });

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid clip listing request.', parsed.error.issues[0]?.message);
  }

  try {
    const clips = parsed.data.analysisId
      ? listClipsByAnalysisId(parsed.data.analysisId)
      : listClips();
    reqDone(200);
    return jsonOk({ clips });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to list saved clips.', errorMessage(error));
  }
};
