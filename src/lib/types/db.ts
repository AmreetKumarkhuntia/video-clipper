export type ChannelInput = {
  id: string;
  title: string;
  description?: string;
  handle?: string;
};

export type ChunkInsert = {
  videoId: string;
  chunk: string; // JSON: { start, end, text }
  analysis?: string; // JSON: ChunkEvaluation
  score?: number;
  start: number;
  end: number;
  rank?: number;
};

export type SegmentationInsert = {
  videoId: string;
  rank: number;
  startSec: number;
  endSec: number;
  score: number;
  reason: string;
  source: string; // 'transcript' | 'audio' | 'both'
  audioEvent?: string;
  optionsHash: string;
};

export type AnalysisInsert = {
  id: string;
  videoId: string;
  planJson: string;
};

export type UpsertClipInput = {
  id: string;
  videoId: string;
  analysisId?: string;
  segmentationId?: string;
  segmentRank: number;
  filename: string;
  path: string;
  startSec: number;
  endSec: number;
  durationSec: number;
};
