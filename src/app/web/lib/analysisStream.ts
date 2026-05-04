import { createParser } from 'eventsource-parser';
import type { ClipPlan, CreateAnalysisRequest } from '@app/web/types/analysis.js';
import type { ChunkEvaluation, RankedSegment } from '@lib/types/index.js';

export interface AnalysisStreamCallbacks {
  onChunkProgress?: (chunkIndex: number, text: string) => void;
  onChunkAnalyzed?: (chunkIndex: number, evaluation: ChunkEvaluation) => void;
  onSegmentProgress?: (rank: number, text: string) => void;
  onSegmentRefined?: (rank: number, segment: RankedSegment) => void;
  onError?: (message: string) => void;
}

export async function streamAnalysis(
  input: CreateAnalysisRequest,
  callbacks: AnalysisStreamCallbacks,
): Promise<ClipPlan> {
  const res = await fetch('/api/analysis/transcript', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
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
    const parser = createParser({
      onEvent(event) {
        if (event.event === 'chunk_progress') {
          const data = JSON.parse(event.data);
          callbacks.onChunkProgress?.(data.chunkIndex, data.text);
        } else if (event.event === 'chunk_analyzed') {
          const data = JSON.parse(event.data);
          callbacks.onChunkAnalyzed?.(data.chunkIndex, data.evaluation);
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
        if (done) return;
        parser.feed(decoder.decode(value, { stream: true }));
        return pump();
      });
    }

    pump().catch(reject);
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
