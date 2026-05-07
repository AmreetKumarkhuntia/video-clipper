import type { UploadArtifact } from './publish.js';

export interface UploadQueueItem {
  clipArtifactId: string;
  title: string;
  status: 'queued' | 'uploading' | 'uploaded' | 'failed';
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

export type UploadStreamEventName =
  | 'upload_started'
  | 'upload_finished'
  | 'upload_failed'
  | 'upload_complete'
  | 'error';

export interface UploadDraftClipsCallbacks {
  onUploadStarted?: (item: import('./publish.js').PublishDraftItem) => void;
  onUploadFinished?: (upload: UploadArtifact) => void;
  onUploadFailed?: (upload: UploadArtifact) => void;
}
