import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { answerVideoQuestion } from '@lib/orchestration/index.js';
import { QaRequestSchema } from '@lib/types/qa.js';
import { logEmittedQaEvent, serializeQaSSE } from '../http/sse/qaEvents.js';
import { errorMessage, parseJsonBody } from '../http/responses.js';
import type { QaStreamCallbacks } from '@lib/types/qa.js';
import type { QaStreamEventName } from '@lib/types/api.js';
import type { ApiEnv } from '../context.js';

/**
 * Streams an answer to a question about a video.
 *
 * The body is validated before the stream opens so a bad request still gets the
 * ordinary error envelope from the middleware. Past that point the response has
 * already committed to 200 text/event-stream, so failures can only be reported
 * as an `error` event — that is why this route carries a try/catch at all.
 */
export const qaRoutes = new Hono<ApiEnv>();

qaRoutes.post('/', async (c) => {
  const input = await parseJsonBody(c.req.raw, QaRequestSchema);
  const requestId = c.get('requestId');
  const config = c.get('config');
  const signal = c.req.raw.signal;

  return streamSSE(c, async (stream) => {
    // Framed by the shared helper rather than stream.writeSSE, so the wire format
    // stays owned by the module the frontend parser is written against.
    // Writes are queued in call order, so the synchronous orchestrator callbacks
    // below can fire and forget without reordering events.
    const send = (eventName: QaStreamEventName, data: unknown): void => {
      logEmittedQaEvent(requestId, eventName, data);
      void stream.write(serializeQaSSE(eventName, data));
    };

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
      await answerVideoQuestion(input, config, callbacks, requestId, signal);
    } catch (error) {
      // A disconnect aborts the model call on its way out. The client is already
      // gone, so that rejection is not a failure worth reporting.
      if (!signal.aborted) {
        send('error', { message: errorMessage(error) });
      }
    }
  });
});
