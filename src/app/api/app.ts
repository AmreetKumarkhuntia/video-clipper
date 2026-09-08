import { Hono } from 'hono';
import { errorEnvelope } from './middleware/errorEnvelope.js';
import { requestContext } from './middleware/requestContext.js';
import { jsonError } from './http/responses.js';
import { analysesRoutes } from './routes/analyses.js';
import { captionPresetsRoutes } from './routes/captionPresets.js';
import { clipsRoutes } from './routes/clips.js';
import { connectionRoutes } from './routes/connection.js';
import { publishRoutes } from './routes/publish.js';
import { qaRoutes } from './routes/qa.js';
import { settingsRoutes } from './routes/settings.js';
import { videosRoutes } from './routes/videos.js';
import { youtubeRoutes } from './routes/youtube.js';
import type { ApiEnv } from './context.js';

/**
 * The backend HTTP surface.
 *
 * Built separately from the server entry so tests can drive it with
 * `app.request(...)` and no socket.
 */
export function createApp(): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();

  app.use('*', requestContext);

  // Mounted more specific first: /api/youtube/connection must win over /api/youtube.
  app.route('/api/youtube/connection', connectionRoutes);
  app.route('/api/youtube', youtubeRoutes);
  app.route('/api/analyses', analysesRoutes);
  app.route('/api/qa', qaRoutes);
  app.route('/api/videos', videosRoutes);
  app.route('/api/clips', clipsRoutes);
  app.route('/api/publish', publishRoutes);
  app.route('/api/caption-presets', captionPresetsRoutes);
  app.route('/api/settings', settingsRoutes);

  app.get('/api/health', (c) => c.json({ ok: true, requestId: c.get('requestId') }));

  // Unknown routes answer in the same envelope as everything else, so the
  // client's error reader never has to special-case a 404.
  app.notFound(() => jsonError(404, 'Not found.'));
  app.onError(errorEnvelope);

  return app;
}
