import { z } from 'zod';

export const AudioEventSchema = z.object({
  time: z.number(),
  event: z.string(),
  confidence: z.number().min(0).max(1),
  source: z.enum(['gemini', 'yamnet', 'whisper']),
});
export type AudioEvent = z.infer<typeof AudioEventSchema>;

export const MergedCandidateSchema = z.object({
  start: z.number(),
  end: z.number(),
  score: z.number().min(1).max(10),
  source: z.enum(['transcript', 'audio', 'both']),
  reason: z.string(),
  audio_event: z.string().optional(),
});
export type MergedCandidate = z.infer<typeof MergedCandidateSchema>;

export interface AudioSource {
  readonly name: string;
  fetchAudio(videoId: string, outputDir: string): Promise<string>;
}

export interface GeminiAnalyzerConfig {
  apiKey: string;
  model: string;
  extraInstructions?: string;
}

export const GeminiEventSchema = z.array(
  z.object({
    time_sec: z.number(),
    event: z.string(),
    confidence: z.number().min(0).max(1),
  }),
);

export interface AnalyzerChainConfig {
  confidenceThreshold: number;
  whisperModel: string;
  gemini: GeminiAnalyzerConfig;
}

export interface SlicerConfig {
  ffmpegPath?: string;
  ffprobePath?: string;
}

export const WhisperSegmentSchema = z.object({
  text: z.string(),
  start: z.number(),
  duration: z.number(),
});
