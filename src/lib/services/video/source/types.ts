import type { VideoMetadata, DownloadResult } from '@lib/types/video.js';
import type { TranscriptLine } from '@lib/types/transcript.js';

export interface VideoSource {
  readonly name: string;

  resolve(input: string): Promise<{ videoId: string; metadata: VideoMetadata }>;

  downloadVideo(
    videoId: string,
    mode: 'all' | number,
    segments?: unknown[],
    customPath?: string,
  ): Promise<DownloadResult>;

  getSubtitles(videoId: string): Promise<TranscriptLine[]>;
}
