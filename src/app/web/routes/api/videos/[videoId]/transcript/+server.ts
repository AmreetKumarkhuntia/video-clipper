import type { RequestHandler } from '@sveltejs/kit';
import {
  loadOrFetchTranscript,
  clearVideoTranscript,
} from '@app/web/lib/services/analysis/transcriptService.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';
import { TranscriptParamsSchema } from '@app/web/types/analysis.js';

export const GET: RequestHandler = async ({ params, locals }) => {
  const reqDone = log.request('GET', '/api/videos/[videoId]/transcript', locals.requestId, {
    videoId: params.videoId,
  });
  const parsed = TranscriptParamsSchema.safeParse(params);

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid transcript request.', zodErrorDetail(parsed.error));
  }

  try {
    const bundle = await loadOrFetchTranscript(parsed.data.videoId, locals.config);
    reqDone(200);
    return jsonOk(bundle);
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to load transcript.', errorMessage(error));
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const videoId = params.videoId ?? '';
  const reqDone = log.request('DELETE', '/api/videos/[videoId]/transcript', locals.requestId, {
    videoId,
  });

  if (!videoId) {
    reqDone(400);
    return jsonError(400, 'Missing videoId.');
  }

  try {
    const result = clearVideoTranscript(videoId);
    reqDone(200);
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to clear transcript.', errorMessage(error));
  }
};
