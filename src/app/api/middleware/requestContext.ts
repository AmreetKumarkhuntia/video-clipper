import type { MiddlewareHandler } from 'hono';
import { generateRequestId, log } from '@lib/utils/logger.js';
import { getConfig } from '@lib/config/index.js';
import type { ApiEnv } from '../context.js';

/**
 * Attaches the request id and config, and logs the request pair.
 *
 * The prototype opened and closed a `log.request` in every single handler. Doing
 * it once here means a new route cannot forget it, and handlers stay about their
 * own work.
 *
 * The backend is now the only process that reads config, which removes the
 * prototype problem of a settings change in one process leaving the others stale.
 */
export const requestContext: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? generateRequestId();
  c.set('requestId', requestId);
  c.set('config', getConfig());
  c.header('x-request-id', requestId);

  const done = log.request(c.req.method, new URL(c.req.url).pathname, requestId);
  await next();
  done(c.res.status);
};
