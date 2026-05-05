import type { Handle } from '@sveltejs/kit';
import { generateRequestId, log } from '@lib/utils/logger.js';
import { getConfig, getMaskedConfig } from '@lib/config/index.js';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.requestId = event.request.headers.get('x-request-id') ?? generateRequestId();
  event.locals.config = getConfig();

  if (event.url.pathname.startsWith('/api/')) {
    log.info(`${event.locals.requestId} [config] ${JSON.stringify(getMaskedConfig())}`);
  }

  return resolve(event);
};
