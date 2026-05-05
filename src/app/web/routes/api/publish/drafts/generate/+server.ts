import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { generatePublishMetadata } from '@app/web/lib/services/publishing/metadataService.js';
import type { MetadataGenerationContext } from '@app/web/types/publish.js';
import { loadYouTubeAuthState } from '@app/web/lib/services/youtube/authStore.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  parseJsonBody,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { GeneratePublishMetadataRequestSchema } from '@app/web/types/publish.js';
import { log } from '@lib/utils/logger.js';

export const POST: RequestHandler = async (event) => {
  const reqDone = log.request('POST', '/api/publish/drafts/generate', event.locals.requestId);

  try {
    const input = await parseJsonBody(event, GeneratePublishMetadataRequestSchema);
    log.info(
      `[publish-metadata] request workflow="${input.workflowTitle}" items=${input.items.length}${input.sourceChannelTitle ? ` source="${input.sourceChannelTitle}"` : ''}`,
    );

    // Best-effort: read upload channel name. Non-throwing — if not connected, omit.
    const auth = await loadYouTubeAuthState().catch(() => null);

    const context: MetadataGenerationContext = {
      videoDescription: input.videoDescription,
      sourceChannelTitle: input.sourceChannelTitle,
      uploadChannelName: auth?.channel.title,
    };

    const items = await generatePublishMetadata(
      input.workflowTitle,
      input.items,
      event.locals.config,
      context,
      event.locals.requestId,
    );
    reqDone(200);
    return jsonOk({ items });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reqDone(400);
      return jsonError(400, 'Invalid metadata generation request.', zodErrorDetail(error));
    }

    reqDone(500);
    log.error(`[publish-metadata] request error: ${errorMessage(error)}`);
    return jsonError(500, 'Failed to generate publish metadata.', errorMessage(error));
  }
};
