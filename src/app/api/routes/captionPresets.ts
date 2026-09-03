import { Hono } from 'hono';
import {
  createCaptionPreset,
  deleteCaptionPreset,
  listCaptionPresets,
  updateCaptionPreset,
} from '@lib/services/db/index.js';
import { PositionSchema, TextStyleSchema } from '@lib/types/clipEdit.js';
import { jsonError, parseJsonBody } from '../http/responses.js';
import type { CaptionPresetInsert } from '@lib/types/db.js';
import type { ApiEnv } from '../context.js';
import { CreateCaptionPresetSchema, UpdateCaptionPresetSchema } from '@lib/types/api.js';

/**
 * CRUD over the operator's saved caption looks.
 *
 * Every handler is a straight repo call: validation throws and the error
 * middleware renders the 400, so the only status these decide themselves is the
 * 404 for an id that is syntactically fine but does not exist.
 */
export const captionPresetsRoutes = new Hono<ApiEnv>();

captionPresetsRoutes.get('/', (c) => {
  return c.json({ presets: listCaptionPresets() });
});

captionPresetsRoutes.post('/', async (c) => {
  const body = await parseJsonBody(c.req.raw, CreateCaptionPresetSchema);

  // `captionPresets` stores style and position as JSON text and the repo still
  // takes them that way, so the encoding has to happen here for now. It belongs
  // in captionPresetsRepo, which is the only place that knows the column shape.
  const preset = createCaptionPreset({
    name: body.name,
    style: JSON.stringify(body.style),
    position: JSON.stringify(body.position),
  });

  return c.json({ preset }, 201);
});

captionPresetsRoutes.put('/:id', async (c) => {
  const body = await parseJsonBody(c.req.raw, UpdateCaptionPresetSchema);

  // Built key by key rather than spread so an absent field stays absent: the
  // repo treats `undefined` as "leave alone", and a partial update must not
  // blank out the fields the client did not send.
  const updates: Partial<CaptionPresetInsert> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.style !== undefined) updates.style = JSON.stringify(body.style);
  if (body.position !== undefined) updates.position = JSON.stringify(body.position);

  const preset = updateCaptionPreset(c.req.param('id'), updates);
  if (!preset) return jsonError(404, 'Caption preset not found.');

  return c.json({ preset });
});

captionPresetsRoutes.delete('/:id', (c) => {
  const deleted = deleteCaptionPreset(c.req.param('id'));
  if (!deleted) return jsonError(404, 'Caption preset not found.');

  return c.body(null, 204);
});
