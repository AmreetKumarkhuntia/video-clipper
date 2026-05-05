import { createParser } from 'eventsource-parser';
import type { UploadArtifact } from '@app/web/types/publish.js';

export type UploadQueueStatus = 'queued' | 'uploading' | 'uploaded' | 'failed';

export interface UploadQueueItem {
  clipArtifactId: string;
  title: string;
  status: UploadQueueStatus;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  error?: string;
}

export interface UploadStreamCallbacks {
  onUploadStarted?: (clipArtifactId: string) => void;
  onUploadFinished?: (upload: UploadArtifact) => void;
  onUploadFailed?: (upload: UploadArtifact) => void;
  onComplete?: (uploads: UploadArtifact[]) => void;
  onError?: (message: string) => void;
}

export async function streamUploads(
  analysisId: string,
  callbacks: UploadStreamCallbacks,
): Promise<UploadArtifact[]> {
  const res = await fetch('/api/youtube/uploads', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ analysisId }),
  });

  if (!res.ok) {
    let message = 'Upload request failed.';
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

  return new Promise<UploadArtifact[]>((resolve, reject) => {
    const parser = createParser({
      onEvent(event) {
        const data = JSON.parse(event.data);

        if (event.event === 'upload_started') {
          callbacks.onUploadStarted?.(data.clipArtifactId);
        } else if (event.event === 'upload_finished') {
          callbacks.onUploadFinished?.(data.upload as UploadArtifact);
        } else if (event.event === 'upload_failed') {
          callbacks.onUploadFailed?.(data.upload as UploadArtifact);
        } else if (event.event === 'upload_complete') {
          callbacks.onComplete?.(data.uploads as UploadArtifact[]);
          resolve(data.uploads as UploadArtifact[]);
        } else if (event.event === 'error') {
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
