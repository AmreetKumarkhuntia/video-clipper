import { z } from 'zod';
import type { Context, ErrorHandler } from 'hono';
import { log } from '@lib/utils/logger.js';
import { HttpError, errorMessage, jsonError, zodErrorDetail } from '../http/responses.js';
import type { ApiEnv } from '../context.js';

/**
 * Registered with `app.onError`, not as middleware.
 *
 * Hono's composer catches a thrown handler error and routes it here; a
 * middleware `try/catch` around `next()` never sees it. Handlers therefore
 * validate with a throwing `.parse()` and carry no try/catch of their own.
 */
export const errorEnvelope: ErrorHandler<ApiEnv> = (error, c) => {
  // A refusal a handler already worded — a guard's 401, say. Not a failure to
  // log, and not ours to rephrase.
  if (error instanceof HttpError) {
    return withRequestId(c, error.response);
  }
  if (error instanceof z.ZodError) {
    return withRequestId(c, jsonError(400, 'Invalid request.', zodErrorDetail(error)));
  }
  // A body that is not valid JSON is the client's mistake, not the server's.
  if (error instanceof SyntaxError) {
    return withRequestId(c, jsonError(400, 'Request body must be valid JSON.'));
  }

  log.error('api', 'unhandled error', c.get('requestId'), { error: errorMessage(error) });
  return withRequestId(c, jsonError(500, errorMessage(error)));
};

/**
 * An error response is built fresh rather than from the context, so headers set
 * during the request are lost. The request id has to be copied onto it, or a
 * failing call becomes the one you cannot trace.
 */
function withRequestId(c: Context<ApiEnv>, res: Response): Response {
  const requestId = c.get('requestId');
  if (requestId) res.headers.set('x-request-id', requestId);
  return res;
}
