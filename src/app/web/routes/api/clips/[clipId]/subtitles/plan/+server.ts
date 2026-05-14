import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { planSubtitles } from '@app/web/lib/services/subtitles/subtitlePlanService.js';
import { PlanSubtitlesRequestSchema } from '@app/web/types/subtitlePlan.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  parseJsonBody,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

export const POST: RequestHandler = async (event) => {
  const reqDone = log.request('POST', '/api/clips/[id]/subtitles/plan', event.locals.requestId);

  try {
    const input = await parseJsonBody(event, PlanSubtitlesRequestSchema);
    log.info(
      'POST /api/clips/[id]/subtitles/plan',
      'subtitle plan request',
      event.locals.requestId,
      { clipId: event.params.clipId, lines: input.subtitles.length },
    );

    const result = await planSubtitles(input, event.locals.config, event.locals.requestId);

    reqDone(200);
    return jsonOk({ lines: result.lines });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reqDone(400);
      return jsonError(400, 'Invalid subtitle plan request.', zodErrorDetail(error));
    }

    reqDone(500);
    log.error(
      'POST /api/clips/[id]/subtitles/plan',
      'subtitle planning failed',
      event.locals.requestId,
      { error: errorMessage(error) },
    );
    return jsonError(500, 'Failed to plan subtitles.', errorMessage(error));
  }
};
