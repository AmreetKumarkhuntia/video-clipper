import { z } from 'zod';
import { TranscriptLineSchema, MicroBlockSchema, LLMChunkSchema } from './transcript.js';
import { ChunkEvaluationSchema } from './segment.js';

export const TranscriptBundleSchema = z.object({
  videoId: z.string(),
  lines: z.array(TranscriptLineSchema),
  microBlocks: z.array(MicroBlockSchema),
  chunks: z.array(LLMChunkSchema),
  fetchedAt: z.string(),
});
export type TranscriptBundle = z.infer<typeof TranscriptBundleSchema>;

export const ClipCandidateSchema = z.object({
  id: z.string(),
  rank: z.number().int().min(1),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  score: z.number().min(1).max(10),
  reason: z.string(),
  source: z.enum(['transcript', 'audio', 'both']),
  audioEvent: z.string().optional(),
  transcriptExcerpt: z.string(),
  selected: z.boolean(),
});
export type ClipCandidate = z.infer<typeof ClipCandidateSchema>;

export const AnalysisOptionsSchema = z.object({
  maxChunks: z.number().int().positive().optional(),
  maxParallel: z.number().int().positive().optional(),
  noCache: z.boolean().default(false),
  threshold: z.number().min(1).max(10).optional(),
  topN: z.number().int().positive().optional(),
  refine: z.boolean().default(true),
});
export type AnalysisOptions = z.infer<typeof AnalysisOptionsSchema>;

export const CreateAnalysisRequestSchema = z.object({
  videoId: z.string().min(1),
  title: z.string().optional(),
  durationSec: z.number().nonnegative().optional(),
  options: AnalysisOptionsSchema.default({ noCache: false, refine: true }),
});
export type CreateAnalysisRequest = z.infer<typeof CreateAnalysisRequestSchema>;

export const ClipPlanSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  title: z.string(),
  durationSec: z.number().nonnegative(),
  candidates: z.array(ClipCandidateSchema),
  chunkEvaluations: z.array(ChunkEvaluationSchema),
  createdAt: z.string(),
});
export type ClipPlan = z.infer<typeof ClipPlanSchema>;

export const ClipSelectionSchema = ClipCandidateSchema.pick({
  id: true,
  rank: true,
  startSec: true,
  endSec: true,
  score: true,
  reason: true,
  source: true,
  audioEvent: true,
});
export type ClipSelection = z.infer<typeof ClipSelectionSchema>;

export const CreateClipsRequestSchema = z.object({
  videoId: z.string().min(1),
  analysisId: z.string().optional(),
  segments: z.array(ClipSelectionSchema).min(1),
});
export type CreateClipsRequest = z.infer<typeof CreateClipsRequestSchema>;

export const ClipArtifactSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  analysisId: z.string().optional(),
  segmentId: z.string(),
  filename: z.string(),
  path: z.string(),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  durationSec: z.number().positive(),
  createdAt: z.string(),
});
export type ClipArtifact = z.infer<typeof ClipArtifactSchema>;
