import type { VideoDetails } from '@lib/types/index.js';
import type { TranscriptBundle, ClipPlan, ClipArtifact } from '@app/web/types/analysis.js';

export interface AnalysisEntry {
  plan: ClipPlan | null;
  clips: ClipArtifact[];
}

export interface VideoEntry {
  video: VideoDetails | null;
  transcript: TranscriptBundle | null;
  analyses: Record<string, AnalysisEntry>; // keyed by analysisId
}

export type VideoStore = Record<string, VideoEntry>; // keyed by videoId
