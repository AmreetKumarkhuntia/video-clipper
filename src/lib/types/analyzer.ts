import type { TranscriptLine, MicroBlock, LLMChunk } from './transcript.js';
import type { AudioEvent } from './audio.js';
import type { ChunkEvaluation, RankedSegment } from './segment.js';
import type { LanguageModel } from 'ai';

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

export interface AnalyzeChunksOpts {
  maxRetries: number;
  systemPrompt: string;
  model: LanguageModel;
  callbacks?: Pick<StreamCallbacks, 'onChunkStarted' | 'onChunkTextDelta' | 'onChunkAnalyzed'>;
  requestId?: string;
}

export interface RefineSegmentsOpts {
  maxRetries: number;
  model: LanguageModel;
  callbacks?: Pick<StreamCallbacks, 'onSegmentStarted' | 'onSegmentTextDelta' | 'onSegmentRefined'>;
  requestId?: string;
  videoTitle?: string;
}

import { z } from 'zod';

export const RefinedBoundariesSchema = z.object({
  clip_start: z.number().describe('Refined clip start time in seconds'),
  clip_end: z.number().describe('Refined clip end time in seconds'),
});
