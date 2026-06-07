import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { answerVideoQuestionForWeb } from '@app/web/lib/services/analysis/qaService.js';
import {
  logEmittedQaEvent,
  serializeQaSSE,
  type QaStreamEventName,
} from '@app/web/lib/services/analysis/qaStreamEvents.js';
import { jsonError, parseJsonBody, zodErrorDetail } from '@app/web/lib/services/http/responses.js';
import { QaRequestSchema } from '@lib/types/qa.js';
import { log } from '@lib/utils/logger.js';
import type { QaStreamCallbacks } from '@app/web/types/qa.js';

export const POST: RequestHandler = async (event) => {
  const reqDone = log.request('POST', '/api/analysis/qa', event.locals.requestId);
  let input;
  try {
    input = await parseJsonBody(event, QaRequestSchema);
  } catch (error) {
    if (error instanceof z.ZodError) {
      reqDone(400);
      return jsonError(400, 'Invalid Q&A request.', zodErrorDetail(error));
    }
    reqDone(500);
    return jsonError(
      500,
      'Failed to parse request.',
      error instanceof Error ? error.message : String(error),
    );
  }

  const abortSignal = event.request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      function send(eventName: QaStreamEventName, data: unknown): void {
        if (closed) return;
        logEmittedQaEvent(event.locals.requestId, eventName, data);
        try {
          controller.enqueue(encoder.encode(serializeQaSSE(eventName, data)));
        } catch {
          // controller was closed — ignore
        }
      }

      function closeOnce(): void {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }

      abortSignal.addEventListener('abort', closeOnce);

      const callbacks: QaStreamCallbacks = {
        onStarted: () => {
          send('qa_started', {});
        },
        onProgress: (text) => {
          send('qa_progress', { text });
        },
        onComplete: (answer) => {
          send('qa_complete', { answer });
        },
        onError: (message) => {
          send('error', { message });
        },
      };

      try {
        await answerVideoQuestionForWeb(
          input,
          event.locals.config,
          callbacks,
          event.locals.requestId,
          abortSignal,
        );
      } catch (error) {
        if (abortSignal.aborted) {
          // Client aborted — do not emit an error event, just close.
        } else {
          send('error', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        closeOnce();
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
