import type { MiddlewareHandler } from 'hono';
import { generateRequestId, log } from '@lib/utils/logger.js';
import { getConfig, getMaskedConfig } from '@lib/config/index.js';
import type { ApiEnv } from '../context.js';

/**
 * Attaches the request id and config to every request.
 *
 * The backend is the only process that reads config now, which removes the
 * prototype problem of a settings change in one process leaving the others stale.
 */
export const requestContext: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? generateRequestId();
  c.set('requestId', requestId);
  c.set('config', getConfig());
  c.header('x-request-id', requestId);

  if (process.env.LOG_REQUEST_CONFIG === 'true') {
    log.info('api', 'request config', requestId, getMaskedConfig());
  }

  await next();
};
