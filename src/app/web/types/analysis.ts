import { z } from 'zod';
import type { ChunkEvaluation, RankedSegment } from '@lib/types/index.js';

export {
  TranscriptBundleSchema,
  ClipCandidateSchema,
  AnalysisOptionsSchema,
  CreateAnalysisRequestSchema,
  ClipPlanSchema,
  ClipSelectionSchema,
  CreateClipsRequestSchema,
  ClipArtifactSchema,
} from '@lib/types/analysis.js';
export type {
  TranscriptBundle,
  ClipCandidate,
  AnalysisOptions,
  CreateAnalysisRequest,
  ClipPlan,
  ClipSelection,
  CreateClipsRequest,
  ClipArtifact,
} from '@lib/types/analysis.js';

export const FileVariantSchema = z.enum(['original', 'edited']);
export type FileVariant = z.infer<typeof FileVariantSchema>;

export interface AnalysisStreamCallbacks {
  onChunkStarted?: (chunkIndex: number) => void;
  onChunkProgress?: (chunkIndex: number, text: string) => void;
  onChunkAnalyzed?: (chunkIndex: number, evaluation: ChunkEvaluation) => void;
  onSegmentStarted?: (rank: number) => void;
  onSegmentProgress?: (rank: number, text: string) => void;
  onSegmentRefined?: (rank: number, segment: RankedSegment) => void;
  onError?: (message: string) => void;
}

export type AnalysisStreamEventName =
  | 'chunk_started'
  | 'chunk_progress'
  | 'chunk_analyzed'
  | 'segment_started'
  | 'segment_progress'
  | 'segment_refined'
  | 'analysis_complete'
  | 'error';

export const AnalysisParamsSchema = z.object({
  analysisId: z.string().min(1),
});
export type AnalysisParams = z.infer<typeof AnalysisParamsSchema>;

export const ClipParamsSchema = z.object({
  clipId: z.string().min(1),
});
export type ClipParams = z.infer<typeof ClipParamsSchema>;

export const ListClipsQuerySchema = z.object({
  analysisId: z.string().optional(),
});
export type ListClipsQuery = z.infer<typeof ListClipsQuerySchema>;

export const TranscriptParamsSchema = z.object({
  videoId: z.string().min(1),
});
export type TranscriptParams = z.infer<typeof TranscriptParamsSchema>;
