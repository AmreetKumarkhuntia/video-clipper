import type { RequestHandler } from '@sveltejs/kit';
import { getTranscriptBundle } from '@app/web/lib/services/analysis/transcriptService.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';
import { TranscriptParamsSchema } from '@app/web/types/analysis.js';

export const GET: RequestHandler = async ({ params, locals }) => {
  const reqDone = log.request('GET', '/api/youtube/videos/[videoId]/transcript', locals.requestId, {
    videoId: params.videoId,
  });
  const parsed = TranscriptParamsSchema.safeParse(params);

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid transcript request.', zodErrorDetail(parsed.error));
  }

  try {
    const transcript = await getTranscriptBundle(parsed.data.videoId, locals.config);
    reqDone(200);
    return jsonOk(transcript);
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to load transcript.', errorMessage(error));
  }
};
