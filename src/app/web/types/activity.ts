import type { ChunkEvaluation, RankedSegment } from '@lib/types/index.js';

export type ActivityStatus = 'running' | 'done' | 'error';
export type ActivityPhase = 'idle' | 'analyzing' | 'refining' | 'complete';

export interface AnalysisActivityItem {
  id: string;
  kind: 'chunk' | 'segment' | 'system';
  title: string;
  status: ActivityStatus;
  detail?: string;
  rawText?: string;
  chunkIndex?: number;
  rank?: number;
  evaluation?: ChunkEvaluation;
  segment?: RankedSegment;
}

export interface HighlightRange {
  start: number;
  end: number;
}
