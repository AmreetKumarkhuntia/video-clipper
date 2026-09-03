import { Hono } from 'hono';
import { errorEnvelope } from './middleware/errorEnvelope.js';
import { requestContext } from './middleware/requestContext.js';
import { jsonError } from './http/responses.js';
import type { ApiEnv } from './context.js';

/**
 * The backend HTTP surface.
 *
 * Routes are mounted here by resource. The app is built separately from the
 * server entry so tests can drive it with `app.request(...)` and no socket.
 */
export function createApp(): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();

  app.use('*', errorEnvelope);
  app.use('*', requestContext);

  app.get('/api/health', (c) => c.json({ ok: true, requestId: c.get('requestId') }));

  // Unknown routes answer in the same envelope as everything else, so the
  // client's error reader never has to special-case a 404.
  app.notFound(() => jsonError(404, 'Not found.'));

  return app;
}
