import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { generateWebClips } from '@app/web/lib/services/clipping/clipService.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  parseJsonBody,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { CreateClipsRequestSchema } from '@app/web/types/analysis.js';
import { log } from '@lib/utils/logger.js';

export const POST: RequestHandler = async (event) => {
  const reqDone = log.request('POST', '/api/clips', event.locals.requestId);
  try {
    const input = await parseJsonBody(event, CreateClipsRequestSchema);
    log.info(
      `${event.locals.requestId} [clips] [api] | analysisId=${input.analysisId} videoId=${input.videoId} segments=${input.segments.length}`,
    );
    const clips = await generateWebClips(input, event.locals.config, event.locals.requestId);
    log.info(
      `${event.locals.requestId} [clips] [api-result] | analysisId=${input.analysisId} generated=${clips.length}`,
    );
    reqDone(200);
    return jsonOk({ clips });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reqDone(400);
      return jsonError(400, 'Invalid clip generation request.', zodErrorDetail(error));
    }

    reqDone(500);
    return jsonError(500, 'Failed to generate clips.', errorMessage(error));
  }
};
