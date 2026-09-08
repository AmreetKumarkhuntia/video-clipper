import { z } from 'zod';
import type { MiddlewareHandler } from 'hono';
import { log } from '@lib/utils/logger.js';
import { errorMessage, jsonError, zodErrorDetail } from '../http/responses.js';
import type { ApiEnv } from '../context.js';

/**
 * Turns a thrown error into the shared error envelope.
 *
 * Handlers can therefore validate and call orchestrators without a try/catch
 * apiece, which is what made the prototype's routes repetitive.
 */
export const errorEnvelope: MiddlewareHandler<ApiEnv> = async (c, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(400, 'Invalid request.', zodErrorDetail(error));
    }
    log.error('api', 'unhandled error', c.get('requestId'), { error: errorMessage(error) });
    return jsonError(500, errorMessage(error));
  }
  return undefined;
};
