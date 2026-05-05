import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { analyzeTranscriptForWeb } from '@app/web/lib/services/analysis/analysisService.js';
import {
  logEmittedAnalysisEvent,
  serializeSSE,
  type AnalysisStreamEventName,
} from '@app/web/lib/services/analysis/streamEvents.js';
import { jsonError, parseJsonBody, zodErrorDetail } from '@app/web/lib/services/http/responses.js';
import { CreateAnalysisRequestSchema } from '@app/web/types/analysis.js';
import { log } from '@lib/utils/logger.js';
import type { StreamCallbacks } from '@lib/types/index.js';

export const POST: RequestHandler = async (event) => {
  const reqDone = log.request('POST', '/api/analysis/transcript', event.locals.requestId);
  let input;
  try {
    input = await parseJsonBody(event, CreateAnalysisRequestSchema);
  } catch (error) {
    if (error instanceof z.ZodError) {
      reqDone(400);
      return jsonError(400, 'Invalid analysis request.', zodErrorDetail(error));
    }
    reqDone(500);
    return jsonError(
      500,
      'Failed to parse request.',
      error instanceof Error ? error.message : String(error),
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(eventName: AnalysisStreamEventName, data: unknown): void {
        logEmittedAnalysisEvent(event.locals.requestId, eventName, data);
        controller.enqueue(encoder.encode(serializeSSE(eventName, data)));
      }

      const callbacks: StreamCallbacks = {
        onChunkStarted: (chunkIndex) => {
          send('chunk_started', { chunkIndex });
        },
        onChunkTextDelta: (chunkIndex, text) => {
          send('chunk_progress', { chunkIndex, text });
        },
        onChunkAnalyzed: (chunkIndex, evaluation) => {
          send('chunk_analyzed', { chunkIndex, evaluation });
        },
        onSegmentStarted: (rank) => {
          send('segment_started', { rank });
        },
        onSegmentTextDelta: (rank, text) => {
          send('segment_progress', { rank, text });
        },
        onSegmentRefined: (rank, segment) => {
          send('segment_refined', { rank, segment });
        },
      };

      try {
        const plan = await analyzeTranscriptForWeb(
          input,
          event.locals.config,
          callbacks,
          event.locals.requestId,
        );
        send('analysis_complete', { plan });
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
