import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { createYouTubeCatalogService } from '@app/web/server/youtube/catalogFactory.js';
import { errorMessage, jsonError, jsonOk, zodErrorDetail } from '@app/web/server/http/responses.js';

const ResolveChannelQuerySchema = z.object({
  input: z.string().min(1),
});

export const GET: RequestHandler = async ({ url }) => {
  const parsed = ResolveChannelQuerySchema.safeParse({
    input: url.searchParams.get('input') ?? '',
  });

  if (!parsed.success) {
    return jsonError(400, 'Invalid channel lookup request.', zodErrorDetail(parsed.error));
  }

  try {
    const catalog = createYouTubeCatalogService();
    const channel = await catalog.resolveChannel(parsed.data.input);
    return jsonOk(channel);
  } catch (error) {
    return jsonError(500, 'Failed to resolve YouTube channel.', errorMessage(error));
  }
};
