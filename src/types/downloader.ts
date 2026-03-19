import type { RankedSegment } from './index.js';

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
