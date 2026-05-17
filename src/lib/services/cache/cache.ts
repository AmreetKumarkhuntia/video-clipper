import type { CacheBackend } from '@lib/types/cache.js';
import type { TranscriptLine, AudioEvent } from '@lib/types/index.js';

/**
 * Facade that wraps a CacheBackend and implements the CacheBackend interface.
 *
 * This means `Cache` can be passed anywhere a `CacheBackend` is expected, so
 * all pipeline consumers work whether they type their parameter as `Cache` or
 * `CacheBackend`. The concrete backend is injected by the factory in
 * factory.ts.
 *
 * Call `close()` at the end of the pipeline to release backend resources
 * (important for the MongoDB backend which holds an open connection).
 */
export class Cache implements CacheBackend {
  constructor(readonly backend: CacheBackend) {}

  // ---- Transcript -----------------------------------------------------------

  async readTranscript(videoId: string): Promise<TranscriptLine[] | null> {
    return this.backend.readTranscript(videoId);
  }

  async writeTranscript(videoId: string, lines: TranscriptLine[]): Promise<void> {
    return this.backend.writeTranscript(videoId, lines);
  }

  // ---- Audio events (whole-video) -------------------------------------------

  async readAudioEvents(
    videoId: string,
    gameProfile: string,
    provider: string,
  ): Promise<AudioEvent[] | null> {
    return this.backend.readAudioEvents(videoId, gameProfile, provider);
  }

  async writeAudioEvents(
    videoId: string,
    gameProfile: string,
    provider: string,
    events: AudioEvent[],
  ): Promise<void> {
    return this.backend.writeAudioEvents(videoId, gameProfile, provider, events);
  }

  // ---- Audio events (per-chunk) ---------------------------------------------

  async readAudioChunk(
    videoId: string,
    gameProfile: string,
    provider: string,
    windowStart: number,
    windowEnd: number,
  ): Promise<AudioEvent[] | null> {
    return this.backend.readAudioChunk(videoId, gameProfile, provider, windowStart, windowEnd);
  }

  async writeAudioChunk(
    videoId: string,
    gameProfile: string,
    provider: string,
    windowStart: number,
    windowEnd: number,
    events: AudioEvent[],
  ): Promise<void> {
    return this.backend.writeAudioChunk(
      videoId,
      gameProfile,
      provider,
      windowStart,
      windowEnd,
      events,
    );
  }

  // ---- Lifecycle ------------------------------------------------------------

  async close(): Promise<void> {
    return this.backend.close();
  }
}
