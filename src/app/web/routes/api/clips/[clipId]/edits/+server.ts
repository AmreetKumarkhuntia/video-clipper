import type { RequestHandler } from '@sveltejs/kit';
import { ClipEditsSchema } from '@lib/types/clipEdit.js';
import { ClipParamsSchema } from '@app/web/types/analysis.js';
import { loadClipEdits, saveClipEdits } from '@app/web/lib/services/clipping/clipEditService.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

export const GET: RequestHandler = async ({ params, locals }) => {
  const reqDone = log.request('GET', '/api/clips/[clipId]/edits', locals.requestId, {
    clipId: params.clipId,
  });
  const parsed = ClipParamsSchema.safeParse(params);

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid clip id.', zodErrorDetail(parsed.error));
  }

  try {
    const edits = await loadClipEdits(locals.config.OUTPUT_DIR, parsed.data.clipId);
    reqDone(200);
    return jsonOk({ edits });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to load clip edits.', errorMessage(error));
  }
};

export const PUT: RequestHandler = async (event) => {
  const reqDone = log.request('PUT', '/api/clips/[clipId]/edits', event.locals.requestId, {
    clipId: event.params.clipId,
  });
  const parsedParams = ClipParamsSchema.safeParse(event.params);

  if (!parsedParams.success) {
    reqDone(400);
    return jsonError(400, 'Invalid clip id.', zodErrorDetail(parsedParams.error));
  }

  let rawBody: unknown;
  try {
    rawBody = await event.request.json();
  } catch {
    reqDone(400);
    return jsonError(400, 'Request body must be valid JSON.');
  }

  const parsedBody = ClipEditsSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    reqDone(400);
    return jsonError(400, 'Invalid edits payload.', zodErrorDetail(parsedBody.error));
  }

  if (parsedBody.data.clipId !== parsedParams.data.clipId) {
    reqDone(400);
    return jsonError(400, 'clipId in body does not match URL parameter.');
  }

  try {
    const saved = await saveClipEdits(event.locals.config.OUTPUT_DIR, parsedBody.data);
    reqDone(200);
    return jsonOk({ edits: saved });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to save clip edits.', errorMessage(error));
  }
};
