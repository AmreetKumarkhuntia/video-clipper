import { Hono } from 'hono';
import { buildConfigRegistry, getMaskedConfig, setConfigValues } from '@lib/config/index.js';
import { log } from '@lib/utils/logger.js';
import { parseJsonBody } from '../http/responses.js';
import { requirePermission } from '../middleware/session.js';
import type { ApiEnv } from '../context.js';
import { SettingsUpdateSchema } from '@lib/types/api.js';

/**
 * Deployment settings.
 *
 * PATCH here mutates PROCESS-GLOBAL config: what it writes is shared by every
 * customer this server answers for and takes effect for all of them at once. So
 * it needs the `settings:write` permission — an admin's session, from the
 * browser's cookie or the CLI's bearer header — not merely a sign-in.
 * Per-customer settings are a later phase and will not be served from this route.
 *
 * GET stays open: it serves the registry and masked values, which the settings
 * page needs before anyone has proven anything.
 */
export const settingsRoutes = new Hono<ApiEnv>();

/**
 * A partial bag of config keys. The real validation is ConfigSchema inside
 * setConfigValues, which sees the update merged over env and file, so validating
 * the individual keys here would reject values that are only valid in that merge.
 */

settingsRoutes.get('/', (c) => {
  return c.json({ registry: buildConfigRegistry(), values: getMaskedConfig() });
});

settingsRoutes.patch('/', async (c) => {
  const customer = requirePermission(c, 'settings:write');
  const updates = await parseJsonBody(c.req.raw, SettingsUpdateSchema);

  // Throws a ZodError when the merged config fails ConfigSchema; the error
  // middleware renders that as a 400.
  const result = setConfigValues(updates);

  // Worth an audit line precisely because the change is global. Keys and who,
  // never the values: they can be secrets.
  log.info('api.settings', 'config updated', c.get('requestId'), {
    customerId: customer.id,
    keys: Object.keys(updates),
  });

  // Masked values are re-read after the write so the client renders what the
  // server now holds rather than an echo of what it sent.
  return c.json({ ...result, values: getMaskedConfig() });
});
