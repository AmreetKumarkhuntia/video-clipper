import { serve } from '@hono/node-server';
import { log } from '@lib/utils/logger.js';
import { runMigrations } from '@lib/services/db/index.js';
import { createApp } from './app.js';

/**
 * Backend entry point.
 *
 * This process owns the database — it is the only one that migrates or writes,
 * which is what removes the prototype's two-writer contention on SQLite.
 */
runMigrations();

const port = Number(process.env.API_PORT ?? 5051);
const hostname = process.env.API_HOST ?? '0.0.0.0';

serve({ fetch: createApp().fetch, port, hostname }, (info) => {
  log.info('api', 'listening', 'startup', { port: info.port, hostname });
});
