import type { RequestHandler } from '@sveltejs/kit';
import { createYouTubeCatalogService } from '@app/web/lib/services/youtube/catalogFactory.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';
import { ResolveChannelQuerySchema } from '@app/web/types/youtube.js';

export const GET: RequestHandler = async ({ url, locals }) => {
  const input = url.searchParams.get('input') ?? '';
  const reqDone = log.request('GET', '/api/youtube/channels/resolve', locals.requestId, { input });
  const parsed = ResolveChannelQuerySchema.safeParse({ input });

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid channel lookup request.', zodErrorDetail(parsed.error));
  }

  try {
    const catalog = createYouTubeCatalogService();
    const channel = await catalog.resolveChannel(parsed.data.input);
    reqDone(200);
    return jsonOk(channel);
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to resolve YouTube channel.', errorMessage(error));
  }
};
