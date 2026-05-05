import type { TranscriptLine, MicroBlock, LLMChunk } from './transcript.js';
import type { AudioEvent } from './audio.js';
import type { ChunkEvaluation, RankedSegment } from './segment.js';

export interface LLMAnalyzerResult {
  lines: TranscriptLine[];
  microBlocks: MicroBlock[];
  chunks: LLMChunk[];
  chunkEvals: ChunkEvaluation[];
}

export interface LLMAnalyzerOpts {
  videoId: string;
  audioPath: string | null;
  audioEvents: AudioEvent[];
  maxChunks?: number;
  maxParallel: number;
  noCache: boolean;
  requestId?: string;
}

export interface TranscriptDetectorResult {
  lines: TranscriptLine[];
  microBlocks: MicroBlock[];
  chunks: LLMChunk[];
}

export interface StreamCallbacks {
  onChunkStarted?: (chunkIndex: number) => void;
  onChunkTextDelta?: (chunkIndex: number, text: string) => void;
  onChunkAnalyzed?: (chunkIndex: number, evaluation: ChunkEvaluation) => void;
  onSegmentStarted?: (segmentRank: number) => void;
  onSegmentTextDelta?: (segmentRank: number, text: string) => void;
  onSegmentRefined?: (segmentRank: number, segment: RankedSegment) => void;
}
