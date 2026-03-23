import type { TranscriptLine, MicroBlock, LLMChunk } from './transcript.js';
import type { ChunkEvaluation } from './segment.js';

export interface LLMAnalyzerResult {
  lines: TranscriptLine[];
  microBlocks: MicroBlock[];
  chunks: LLMChunk[];
  chunkEvals: ChunkEvaluation[];
}

export interface LLMAnalyzerOpts {
  videoId: string;
  audioPath: string | null;
  audioEvents: import('./audio.js').AudioEvent[];
  maxChunks?: number;
  maxParallel: number;
  noCache: boolean;
}

export interface TranscriptDetectorResult {
  lines: TranscriptLine[];
  microBlocks: MicroBlock[];
  chunks: LLMChunk[];
}
