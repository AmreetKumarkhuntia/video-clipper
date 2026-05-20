import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { TextStyleSchema, PositionSchema } from '@lib/types/clipEdit.js';
import {
  listCaptionPresets,
  createCaptionPreset,
} from '@lib/services/db/repos/captionPresetsRepo.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

const CreatePresetBodySchema = z.object({
  name: z.string().min(1).max(80),
  style: TextStyleSchema,
  position: PositionSchema,
});

export const GET: RequestHandler = ({ locals }) => {
  const reqDone = log.request('GET', '/api/caption-presets', locals.requestId);
  try {
    const presets = listCaptionPresets();
    reqDone(200);
    return jsonOk({ presets });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to load caption presets.', errorMessage(error));
  }
};

export const POST: RequestHandler = async (event) => {
  const reqDone = log.request('POST', '/api/caption-presets', event.locals.requestId);

  let rawBody: unknown;
  try {
    rawBody = await event.request.json();
  } catch {
    reqDone(400);
    return jsonError(400, 'Request body must be valid JSON.');
  }

  const parsed = CreatePresetBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid preset payload.', zodErrorDetail(parsed.error));
  }

  try {
    const preset = createCaptionPreset({
      name: parsed.data.name,
      style: JSON.stringify(parsed.data.style),
      position: JSON.stringify(parsed.data.position),
    });
    reqDone(201);
    return jsonOk({ preset }, { status: 201 });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to create caption preset.', errorMessage(error));
  }
};
