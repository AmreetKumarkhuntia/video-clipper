import { z } from 'zod';
import type { TranscriptLine } from './transcript.js';
import type { LLMChunk } from './transcript.js';
import type { ChunkEvaluation } from './segment.js';
import type { AudioEvent } from './audio.js';

export const SegmentRefinementSchema = z.object({
  refined_start: z.number(),
  refined_end: z.number(),
});

export type SegmentRefinement = z.infer<typeof SegmentRefinementSchema>;

export interface CacheBackend {
  readTranscript(videoId: string): Promise<TranscriptLine[] | null>;
  writeTranscript(videoId: string, lines: TranscriptLine[]): Promise<void>;
  readChunk(chunk: LLMChunk, chunkAudioEvents?: AudioEvent[]): Promise<ChunkEvaluation | null>;
  writeChunk(
    chunk: LLMChunk,
    evaluation: ChunkEvaluation,
    chunkAudioEvents?: AudioEvent[],
  ): Promise<void>;
  readSegmentRefinement(
    start: number,
    end: number,
    reason: string,
  ): Promise<SegmentRefinement | null>;
  writeSegmentRefinement(
    start: number,
    end: number,
    reason: string,
    refined: SegmentRefinement,
  ): Promise<void>;
  readAudioEvents(
    videoId: string,
    gameProfile: string,
    provider: string,
  ): Promise<AudioEvent[] | null>;
  writeAudioEvents(
    videoId: string,
    gameProfile: string,
    provider: string,
    events: AudioEvent[],
  ): Promise<void>;
  readAudioChunk(
    videoId: string,
    gameProfile: string,
    provider: string,
    windowStart: number,
    windowEnd: number,
  ): Promise<AudioEvent[] | null>;
  writeAudioChunk(
    videoId: string,
    gameProfile: string,
    provider: string,
    windowStart: number,
    windowEnd: number,
    events: AudioEvent[],
  ): Promise<void>;
  close(): Promise<void>;
}

export interface CacheDocument<T> {
  cacheKey: string;
  data: T;
  createdAt: Date;
}

export interface VideoCacheManifest {
  chunkHashes: string[];
  segmentHashes: string[];
}

export interface ClearVideoAnalysisResult {
  manifestExisted: boolean;
  chunksDeleted: number;
  segmentsDeleted: number;
}
