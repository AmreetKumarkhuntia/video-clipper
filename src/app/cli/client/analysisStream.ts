import { ClipPlanSchema } from '@lib/types/analysis.js';
import { ChunkEvaluationSchema, RankedSegmentSchema } from '@lib/types/segment.js';
import { apiStream } from './index.js';
import type { ClipPlan, CreateAnalysisRequest } from '@lib/types/analysis.js';
import type { StreamCallbacks } from '@lib/types/index.js';

/** SSE payloads arrive as `unknown`; the event name says which field to read. */
function field(data: unknown, key: string): unknown {
  return (data as Record<string, unknown> | null)?.[key];
}

function streamText(data: unknown): string {
  const text = field(data, 'text');
  return typeof text === 'string' ? text : '';
}

function streamErrorMessage(data: unknown): string {
  const message = field(data, 'message');
  return typeof message === 'string'
    ? message
    : 'The backend reported an unknown analysis failure.';
}

/**
 * Replays the backend's analysis events into the same callbacks the in-process
 * pipeline drove, so every progress line the prototype printed still comes from
 * the shared formatter and nothing about the wording lives here.
 *
 * Returns null when the caller aborts or the backend closes the stream without
 * a plan; both are the caller's to report, since only it knows which happened.
 */
export async function streamAnalysis(
  input: CreateAnalysisRequest,
  callbacks: StreamCallbacks,
  isAborted: () => boolean,
): Promise<ClipPlan | null> {
  for await (const { event, data } of apiStream('/api/analyses', 'POST', input)) {
    if (isAborted()) return null;

    if (event === 'chunk_started') {
      callbacks.onChunkStarted?.(Number(field(data, 'chunkIndex')));
    } else if (event === 'chunk_progress') {
      callbacks.onChunkTextDelta?.(Number(field(data, 'chunkIndex')), streamText(data));
    } else if (event === 'chunk_analyzed') {
      const evaluation = ChunkEvaluationSchema.parse(field(data, 'evaluation'));
      callbacks.onChunkAnalyzed?.(Number(field(data, 'chunkIndex')), evaluation);
    } else if (event === 'segment_started') {
      callbacks.onSegmentStarted?.(Number(field(data, 'rank')));
    } else if (event === 'segment_progress') {
      callbacks.onSegmentTextDelta?.(Number(field(data, 'rank')), streamText(data));
    } else if (event === 'segment_refined') {
      const segment = RankedSegmentSchema.parse(field(data, 'segment'));
      callbacks.onSegmentRefined?.(Number(field(data, 'rank')), segment);
    } else if (event === 'analysis_complete') {
      return ClipPlanSchema.parse(field(data, 'plan'));
    } else if (event === 'error') {
      // Raised verbatim: the status line was gone by the time this failed, so
      // the event carries the only message, already phrased for a human.
      throw new Error(streamErrorMessage(data));
    }
  }

  return null;
}
