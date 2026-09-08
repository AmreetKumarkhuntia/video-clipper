import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { runAnalysis } from '@lib/orchestration/index.js';
import { CreateAnalysisRequestSchema } from '@lib/types/analysis.js';
import { AnalysisParamsSchema } from '@lib/types/api.js';
import { getAnalysis, listAnalyses } from '../services/artifactStore.js';
import { logEmittedAnalysisEvent } from '../http/sse/analysisEvents.js';
import { errorMessage, jsonError, parseJsonBody } from '../http/responses.js';
import type { AnalysisStreamEventName } from '@lib/types/api.js';
import type { StreamCallbacks } from '@lib/types/index.js';
import type { ApiEnv } from '../context.js';

/**
 * The analysis resource: running one creates it, and saved ones are read back.
 *
 * The prototype split these across `/api/analysis/transcript` and
 * `/api/library/analyses`; a transcript is an input to an analysis and `library`
 * was a UI grouping, so both collapse into this one collection.
 */
export const analysesRoutes = new Hono<ApiEnv>();

analysesRoutes.post('/', async (c) => {
  const input = await parseJsonBody(c.req.raw, CreateAnalysisRequestSchema);
  const requestId = c.get('requestId');
  const config = c.get('config');

  // A client disconnect must cancel the LLM work, not just the response body,
  // so the request signal is handed to the orchestrator.
  const signal = c.req.raw.signal;

  return streamSSE(c, async (stream) => {
    // The orchestrator's callbacks are synchronous while `writeSSE` is async, so
    // events are appended to a single chain: that keeps them in emission order
    // and gives the handler one promise to flush before Hono closes the stream.
    let flushed: Promise<void> = Promise.resolve();

    function send(eventName: AnalysisStreamEventName, data: unknown): void {
      if (stream.aborted || stream.closed) return;
      logEmittedAnalysisEvent(requestId, eventName, data);
      flushed = flushed.then(() =>
        stream.writeSSE({ event: eventName, data: JSON.stringify(data) }),
      );
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
      const plan = await runAnalysis(input, config, callbacks, requestId, signal);
      send('analysis_complete', { plan });
    } catch (error) {
      // The status line is long gone by the time analysis fails, so a failure can
      // only be reported as an event. An abort is the client's own doing and has
      // nobody left to read it, so it stays silent.
      if (!signal.aborted) {
        send('error', { message: errorMessage(error) });
      }
    }

    await flushed;
  });
});

analysesRoutes.get('/', async (c) => {
  const analyses = await listAnalyses();
  return c.json({ analyses });
});

analysesRoutes.get('/:analysisId', async (c) => {
  const { analysisId } = AnalysisParamsSchema.parse({ analysisId: c.req.param('analysisId') });
  const analysis = await getAnalysis(analysisId);

  if (!analysis) {
    return jsonError(404, 'Analysis artifact was not found.');
  }

  return c.json(analysis);
});
