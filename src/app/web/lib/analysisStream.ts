import { createParser } from 'eventsource-parser';
import type { ClipPlan, CreateAnalysisRequest } from '@app/web/types/analysis.js';
import type { ChunkEvaluation, RankedSegment } from '@lib/types/index.js';

import type { AnalysisStreamCallbacks } from '@app/web/types/analysis.js';

export type { AnalysisStreamCallbacks };

export async function streamAnalysis(
  input: CreateAnalysisRequest,
  callbacks: AnalysisStreamCallbacks,
  signal?: AbortSignal,
): Promise<ClipPlan> {
  const res = await fetch('/api/analysis/transcript', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });

  if (!res.ok) {
    let message = 'Analysis request failed.';
    try {
      const body: unknown = await res.json();
      message = readApiError(body);
    } catch {}
    throw new Error(message);
  }

  const body = res.body;
  if (!body) throw new Error('No response body.');

  const reader = body.getReader();
  const decoder = new TextDecoder();

  return new Promise<ClipPlan>((resolve, reject) => {
    let aborted = false;
    const onAbort = (): void => {
      aborted = true;
      try {
        reader.cancel().catch(() => {});
      } catch {
        // already cancelled
      }
      reject(new DOMException('Analysis aborted', 'AbortError'));
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const parser = createParser({
      onEvent(event) {
        if (event.event === 'chunk_started') {
          const data = JSON.parse(event.data);
          callbacks.onChunkStarted?.(data.chunkIndex);
        } else if (event.event === 'chunk_progress') {
          const data = JSON.parse(event.data);
          callbacks.onChunkProgress?.(data.chunkIndex, data.text);
        } else if (event.event === 'chunk_analyzed') {
          const data = JSON.parse(event.data);
          callbacks.onChunkAnalyzed?.(data.chunkIndex, data.evaluation);
        } else if (event.event === 'segment_started') {
          const data = JSON.parse(event.data);
          callbacks.onSegmentStarted?.(data.rank);
        } else if (event.event === 'segment_progress') {
          const data = JSON.parse(event.data);
          callbacks.onSegmentProgress?.(data.rank, data.text);
        } else if (event.event === 'segment_refined') {
          const data = JSON.parse(event.data);
          callbacks.onSegmentRefined?.(data.rank, data.segment);
        } else if (event.event === 'analysis_complete') {
          const data = JSON.parse(event.data);
          resolve(data.plan as ClipPlan);
        } else if (event.event === 'error') {
          const data = JSON.parse(event.data);
          callbacks.onError?.(data.message);
          reject(new Error(data.message));
        }
      },
    });

    function pump(): Promise<void> {
      return reader.read().then(({ done, value }) => {
        if (done || aborted) return;
        parser.feed(decoder.decode(value, { stream: true }));
        return pump();
      });
    }

    pump().catch((err) => {
      if (aborted) return;
      reject(err);
    });
  });
}

function readApiError(body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'object' &&
    body.error !== null &&
    'message' in body.error &&
    typeof body.error.message === 'string'
  ) {
    return body.error.message;
  }
  return 'Something went wrong.';
}
