import type { RequestHandler } from '@sveltejs/kit';
import { clearDatabase } from '@lib/services/db/repos/adminRepo.js';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

export const DELETE: RequestHandler = async ({ locals }) => {
  const reqDone = log.request('DELETE', '/api/db', locals.requestId);
  try {
    clearDatabase();
    reqDone(200);
    return jsonOk({ ok: true });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to clear database.', errorMessage(error));
  }
};
