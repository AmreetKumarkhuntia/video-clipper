import { z } from 'zod';
import type { TranscriptLine, MicroBlock, LLMChunk } from './transcript/types.js';

export type { TranscriptLine, MicroBlock, LLMChunk } from './transcript/types.js';
export { TranscriptLineSchema, MicroBlockSchema, LLMChunkSchema } from './transcript/types.js';

export type { AudioEvent, MergedCandidate } from '../audio/types.js';
export { AudioEventSchema, MergedCandidateSchema } from '../audio/types.js';

export const AnalyzedSegmentSchema = z.object({
  interesting: z.boolean(),
  score: z.number().min(1).max(10),
  reason: z.string(),
  clip_start: z.number(),
  clip_end: z.number(),
});
export type AnalyzedSegment = z.infer<typeof AnalyzedSegmentSchema>;

export const RankedSegmentSchema = z.object({
  rank: z.number().int().min(1),
  start: z.number(),
  end: z.number(),
  score: z.number().min(1).max(10),
  reason: z.string(),
  source: z.enum(['transcript', 'audio', 'both']),
  audio_event: z.string().optional(),
});
export type RankedSegment = z.infer<typeof RankedSegmentSchema>;

const ChunkEvaluationBaseSchema = z.object({
  chunk_index: z.number().int().min(0),
  chunk_start: z.number(),
  chunk_end: z.number(),
});

export const ChunkEvaluationSchema = z.discriminatedUnion('status', [
  ChunkEvaluationBaseSchema.extend({
    status: z.literal('success'),
    interesting: z.boolean(),
    score: z.number().min(1).max(10),
    reason: z.string(),
    clip_start: z.number(),
    clip_end: z.number(),
  }),
  ChunkEvaluationBaseSchema.extend({
    status: z.literal('failed'),
    error: z.string(),
  }),
]);
export type ChunkEvaluation = z.infer<typeof ChunkEvaluationSchema>;

export interface LLMAnalyzerResult {
  lines: TranscriptLine[];
  microBlocks: MicroBlock[];
  chunks: LLMChunk[];
  chunkEvals: ChunkEvaluation[];
}

export interface LLMAnalyzerOpts {
  videoId: string;
  audioPath: string | null;
  audioEvents: import('../audio/types.js').AudioEvent[];
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
  onChunkTextDelta?: (chunkIndex: number, text: string) => void;
  onChunkAnalyzed?: (chunkIndex: number, evaluation: ChunkEvaluation) => void;
  onSegmentTextDelta?: (segmentRank: number, text: string) => void;
  onSegmentRefined?: (segmentRank: number, segment: RankedSegment) => void;
}
