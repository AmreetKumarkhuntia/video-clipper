import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { TextStyleSchema, PositionSchema } from '@lib/types/clipEdit.js';
import {
  updateCaptionPreset,
  deleteCaptionPreset,
} from '@lib/services/db/repos/captionPresetsRepo.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

const UpdatePresetBodySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  style: TextStyleSchema.optional(),
  position: PositionSchema.optional(),
});

export const PUT: RequestHandler = async (event) => {
  const id = event.params.id ?? '';
  const reqDone = log.request('PUT', '/api/caption-presets/[id]', event.locals.requestId, { id });

  let rawBody: unknown;
  try {
    rawBody = await event.request.json();
  } catch {
    reqDone(400);
    return jsonError(400, 'Request body must be valid JSON.');
  }

  const parsed = UpdatePresetBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid preset update payload.', zodErrorDetail(parsed.error));
  }

  try {
    const updates: { name?: string; style?: string; position?: string } = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.style !== undefined) updates.style = JSON.stringify(parsed.data.style);
    if (parsed.data.position !== undefined) updates.position = JSON.stringify(parsed.data.position);

    const preset = updateCaptionPreset(id, updates);
    if (!preset) {
      reqDone(404);
      return jsonError(404, 'Caption preset not found.');
    }
    reqDone(200);
    return jsonOk({ preset });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to update caption preset.', errorMessage(error));
  }
};

export const DELETE: RequestHandler = ({ params, locals }) => {
  const id = params.id ?? '';
  const reqDone = log.request('DELETE', '/api/caption-presets/[id]', locals.requestId, { id });

  try {
    const deleted = deleteCaptionPreset(id);
    if (!deleted) {
      reqDone(404);
      return jsonError(404, 'Caption preset not found.');
    }
    reqDone(204);
    return new Response(null, { status: 204 });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to delete caption preset.', errorMessage(error));
  }
};
