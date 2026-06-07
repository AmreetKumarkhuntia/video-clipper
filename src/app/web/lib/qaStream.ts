import { createParser } from 'eventsource-parser';
import type { QaAnswer, QaMessage, QaRequest } from '@lib/types/qa.js';
import type { QaStreamCallbacks } from '@app/web/types/qa.js';

export async function streamQa(
  input: QaRequest,
  callbacks: QaStreamCallbacks,
  signal?: AbortSignal,
): Promise<QaAnswer> {
  const res = await fetch('/api/analysis/qa', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });

  if (!res.ok) {
    let message = 'Q&A request failed.';
    try {
      const body: unknown = await res.json();
      message = readApiError(body);
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  const body = res.body;
  if (!body) throw new Error('No response body.');

  const reader = body.getReader();
  const decoder = new TextDecoder();

  return new Promise<QaAnswer>((resolve, reject) => {
    let aborted = false;
    const onAbort = (): void => {
      aborted = true;
      try {
        reader.cancel().catch(() => {});
      } catch {
        // already cancelled
      }
      reject(new DOMException('Q&A aborted', 'AbortError'));
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
        if (event.event === 'qa_started') {
          callbacks.onStarted?.();
        } else if (event.event === 'qa_progress') {
          const data = JSON.parse(event.data) as { text: string };
          callbacks.onProgress?.(data.text);
        } else if (event.event === 'qa_complete') {
          const data = JSON.parse(event.data) as { answer: QaAnswer };
          callbacks.onComplete?.(data.answer);
          resolve(data.answer);
        } else if (event.event === 'error') {
          const data = JSON.parse(event.data) as { message: string };
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
      reject(err as Error);
    });
  });
}

export async function loadQaThread(videoId: string): Promise<QaMessage[]> {
  const res = await fetch(`/api/videos/${videoId}/qa`);
  if (!res.ok) return [];
  return (await res.json()) as QaMessage[];
}

export async function clearQaThread(videoId: string): Promise<void> {
  await fetch(`/api/videos/${videoId}/qa`, { method: 'DELETE' });
}

function readApiError(body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as Record<string, unknown>).error === 'object' &&
    (body as Record<string, unknown>).error !== null
  ) {
    const err = (body as Record<string, unknown>).error as Record<string, unknown>;
    if (typeof err.message === 'string') return err.message;
  }
  return 'Something went wrong.';
}
