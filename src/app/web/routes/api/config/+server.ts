import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { buildConfigRegistry, getMaskedConfig, setConfigValues } from '@lib/config/index.js';
import {
  jsonOk,
  jsonError,
  parseJsonBody,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';
import { ConfigUpdateSchema } from '@app/web/types/web.js';

export const GET: RequestHandler = async (event) => {
  const reqDone = log.request('GET', '/api/config', event.locals.requestId);

  try {
    const registry = buildConfigRegistry();
    const values = getMaskedConfig();

    reqDone(200);
    return jsonOk({ registry, values });
  } catch (error) {
    reqDone(500);
    return jsonError(
      500,
      'Failed to load config',
      error instanceof Error ? error.message : String(error),
    );
  }
};

export const POST: RequestHandler = async (event) => {
  const reqDone = log.request('POST', '/api/config', event.locals.requestId);

  try {
    const updates = await parseJsonBody(event, ConfigUpdateSchema);
    const result = setConfigValues(updates);
    const values = getMaskedConfig();

    reqDone(200);
    return jsonOk({ ...result, values });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reqDone(400);
      return jsonError(400, 'Invalid config values', zodErrorDetail(error));
    }
    reqDone(500);
    return jsonError(
      500,
      'Failed to update config',
      error instanceof Error ? error.message : String(error),
    );
  }
};
