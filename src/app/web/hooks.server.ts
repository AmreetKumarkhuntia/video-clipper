import type { Handle } from '@sveltejs/kit';
import { generateRequestId } from '@lib/utils/logger.js';

/**
 * The frontend's only server-side concern is correlating a page request with the
 * backend calls it makes.
 *
 * Config, migrations and session resolution all moved to the backend — this app
 * holds no domain logic and opens no database.
 */
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.requestId = event.request.headers.get('x-request-id') ?? generateRequestId();
  return resolve(event);
};
