import type { Handle } from '@sveltejs/kit';
import { generateRequestId } from '@lib/utils/logger.js';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.requestId = event.request.headers.get('x-request-id') ?? generateRequestId();
  return resolve(event);
};
