import { serve } from '@hono/node-server';
import { log } from '@lib/utils/logger.js';
import { deleteExpiredSessions, runMigrations } from '@lib/services/db/index.js';
import { createApp } from './app.js';

/**
 * Backend entry point.
 *
 * This process owns the database — it is the only one that migrates or writes,
 * which is what removes the prototype's two-writer contention on SQLite.
 */
runMigrations();

// Expired sessions are invisible to `findValidSession` but still rows; without
// a sweep the table only ever grows. Hourly is plenty for a session table, and
// `unref` keeps the timer from holding the process open on shutdown.
deleteExpiredSessions();
setInterval(() => deleteExpiredSessions(), 60 * 60 * 1000).unref();

const port = Number(process.env.API_PORT ?? 5051);
const hostname = process.env.API_HOST ?? '0.0.0.0';

serve({ fetch: createApp().fetch, port, hostname }, (info) => {
  log.info('api', 'listening', 'startup', { port: info.port, hostname });
});
