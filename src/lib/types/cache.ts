import type { TranscriptLine } from './transcript.js';
import type { AudioEvent } from './audio.js';

export interface CacheBackend {
  readTranscript(videoId: string): Promise<TranscriptLine[] | null>;
  writeTranscript(videoId: string, lines: TranscriptLine[]): Promise<void>;
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
