import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { listUploadArtifactsByAnalysisId } from '@app/web/lib/services/artifacts/artifactStore.js';
import { uploadDraftClips } from '@app/web/lib/services/publishing/uploadService.js';
import {
  logEmittedUploadEvent,
  serializeUploadSSE,
} from '@app/web/lib/services/publishing/uploadStreamEvents.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  parseJsonBody,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { CreateUploadsRequestSchema, ListUploadsQuerySchema } from '@app/web/types/publish.js';
import { log } from '@lib/utils/logger.js';

export const GET: RequestHandler = async ({ locals, url }) => {
  const reqDone = log.request('GET', '/api/youtube/uploads', locals.requestId);
  const parsed = ListUploadsQuerySchema.safeParse({
    analysisId: url.searchParams.get('analysisId') ?? undefined,
  });

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid upload listing request.', zodErrorDetail(parsed.error));
  }

  try {
    const uploads = await listUploadArtifactsByAnalysisId(
      locals.config.OUTPUT_DIR,
      parsed.data.analysisId,
    );
    reqDone(200);
    return jsonOk({ uploads });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to load upload history.', errorMessage(error));
  }
};

export const POST: RequestHandler = async (event) => {
  const reqDone = log.request('POST', '/api/youtube/uploads', event.locals.requestId);

  try {
    const input = await parseJsonBody(event, CreateUploadsRequestSchema);
    log.info('POST /api/youtube/uploads', 'upload request', event.locals.requestId, {
      analysisId: input.analysisId,
      requestedClips: input.clipArtifactIds?.length ?? 0,
      selectedOnly: !input.clipArtifactIds?.length,
    });
    const uploads = await uploadDraftClips(input, event.locals.config, event.locals.requestId);
    const uploaded = uploads.filter((upload) => upload.status === 'uploaded').length;
    const failed = uploads.length - uploaded;
    log.info('POST /api/youtube/uploads', 'upload complete', event.locals.requestId, {
      analysisId: input.analysisId,
      uploaded,
      failed,
      total: uploads.length,
    });
    reqDone(200);
    return jsonOk({ uploads });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reqDone(400);
      return jsonError(400, 'Invalid upload request.', zodErrorDetail(error));
    }

    reqDone(500);
    return jsonError(500, 'Failed to upload clips to YouTube.', errorMessage(error));
  }
};

export const PUT: RequestHandler = async (event) => {
  const reqDone = log.request('PUT', '/api/youtube/uploads', event.locals.requestId);
  let input;

  try {
    input = await parseJsonBody(event, CreateUploadsRequestSchema);
  } catch (error) {
    if (error instanceof z.ZodError) {
      reqDone(400);
      return jsonError(400, 'Invalid upload request.', zodErrorDetail(error));
    }

    reqDone(500);
    return jsonError(500, 'Failed to parse upload request.', errorMessage(error));
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(
        eventName:
          | 'upload_started'
          | 'upload_finished'
          | 'upload_failed'
          | 'upload_complete'
          | 'error',
        data: unknown,
      ): void {
        logEmittedUploadEvent(event.locals.requestId, eventName, data);
        controller.enqueue(encoder.encode(serializeUploadSSE(eventName, data)));
      }

      try {
        const uploads = await uploadDraftClips(input, event.locals.config, event.locals.requestId, {
          onUploadStarted: (item) => {
            send('upload_started', {
              clipArtifactId: item.clipArtifactId,
            });
          },
          onUploadFinished: (upload) => {
            send('upload_finished', { upload });
          },
          onUploadFailed: (upload) => {
            send('upload_failed', { upload });
          },
        });

        send('upload_complete', { uploads });
      } catch (error) {
        send('error', {
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  reqDone(200);
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
