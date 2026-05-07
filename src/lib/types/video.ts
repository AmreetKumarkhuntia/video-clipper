import { z } from 'zod';
import { RankedSegmentSchema, ChunkEvaluationSchema } from './segment.js';
import type { YtDlpCookies } from './downloader.js';
import type { TranscriptLine } from './transcript.js';

export const VideoMetadataSchema = z.object({
  videoId: z.string().length(11),
  title: z.string(),
  duration: z.number(), // seconds
});
export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

export const PipelineResultSchema = z.object({
  video_id: z.string().length(11),
  title: z.string(),
  duration: z.number(), // seconds
  chunk_evaluations: z.array(ChunkEvaluationSchema),
  segments: z.array(RankedSegmentSchema),
});
export type PipelineResult = z.infer<typeof PipelineResultSchema>;

export type DownloadMode = 'all' | 'segments';

export interface DownloadResultAll {
  mode: 'all';
  path: string;
}

export interface DownloadResultSegments {
  mode: 'segments';
  paths: string[];
}

export type DownloadResult = DownloadResultAll | DownloadResultSegments;

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

export interface ClipperConfig {
  ffmpegPath?: string;
  ffprobePath?: string;
  timestampOffset: number;
  ffmpegPreset: string;
  outputDir: string;
}
