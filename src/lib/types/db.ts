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
