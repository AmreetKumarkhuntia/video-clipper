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

export type ChannelRecord = {
  id: string;
  title: string;
  description: string | null;
  handle: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ChunkRecord = {
  id: string;
  videoId: string;
  chunk: string;
  analysis: string | null;
  score: number | null;
  start: number;
  end: number;
  rank: number | null;
  createdAt: number;
  updatedAt: number;
};

export type ChunkAnalysisUpdate = {
  start: number;
  end: number;
  analysis: string | null;
  score: number | null;
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

export type CaptionPresetRecord = {
  id: string;
  name: string;
  style: string; // JSON: TextStyle
  position: string; // JSON: Position
  createdAt: number;
  updatedAt: number;
};

export type CaptionPresetInsert = {
  name: string;
  style: string; // JSON: TextStyle
  position: string; // JSON: Position
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

export type ClipRowRecord = {
  id: string;
  videoId: string;
  analysisId: string | null;
  segmentationId: string | null;
  segmentRank: number;
  filename: string;
  path: string;
  editedPath: string | null;
  editsJson: string | null;
  currentEditsHash: string | null;
  lastRenderedHash: string | null;
  startSec: number;
  endSec: number;
  durationSec: number;
  createdAt: number;
  updatedAt: number;
};

export type VideoRecord = {
  id: string;
  channelId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  durationSec: number;
  tags: string;
  thumbnailUrl: string | null;
  transcriptLines: string | null;
  transcriptFetchedAt: string | null;
  createdAt: number;
  updatedAt: number;
};
