import type { CacheBackend } from './cacheBackend.js';
import type {
  TranscriptLine,
  LLMChunk,
  ChunkEvaluation,
  AudioEvent,
  SegmentRefinement,
} from '@lib/types/index.js';
import {
  FileCacheBackend,
  computeChunkCacheKey,
  computeSegmentRefinementCacheKey,
} from './fileCacheBackend.js';
import { appendChunkHash, appendSegmentHash } from './analysisCacheManifest.js';

export type { CacheBackend };

/**
 * Facade that wraps a CacheBackend and implements the CacheBackend interface.
 *
 * This means `Cache` can be passed anywhere a `CacheBackend` is expected, so
 * all pipeline consumers work whether they type their parameter as `Cache` or
 * `CacheBackend`. The concrete backend is injected by the factory in
 * cacheFactory.ts.
 *
 * Call `close()` at the end of the pipeline to release backend resources
 * (important for the MongoDB backend which holds an open connection).
 */
export class Cache implements CacheBackend {
  constructor(
    readonly backend: CacheBackend,
    private readonly videoId?: string,
  ) {}

  private get manifestCacheDir(): string | null {
    if (!this.videoId) return null;
    if (this.backend instanceof FileCacheBackend) return this.backend.cacheDir;
    return null;
  }

  // ---- Transcript -----------------------------------------------------------

  async readTranscript(videoId: string): Promise<TranscriptLine[] | null> {
    return this.backend.readTranscript(videoId);
  }

  async writeTranscript(videoId: string, lines: TranscriptLine[]): Promise<void> {
    return this.backend.writeTranscript(videoId, lines);
  }

  // ---- LLM chunk results ----------------------------------------------------

  async readChunk(
    chunk: LLMChunk,
    chunkAudioEvents?: AudioEvent[],
  ): Promise<ChunkEvaluation | null> {
    return this.backend.readChunk(chunk, chunkAudioEvents);
  }

  async writeChunk(
    chunk: LLMChunk,
    evaluation: ChunkEvaluation,
    chunkAudioEvents?: AudioEvent[],
  ): Promise<void> {
    await this.backend.writeChunk(chunk, evaluation, chunkAudioEvents);
    const cacheDir = this.manifestCacheDir;
    if (cacheDir && this.videoId && evaluation.status === 'success') {
      const hash = computeChunkCacheKey(chunk, chunkAudioEvents ?? []);
      await appendChunkHash(cacheDir, this.videoId, hash);
    }
  }

  // ---- Segment refinement ---------------------------------------------------

  async readSegmentRefinement(
    start: number,
    end: number,
    reason: string,
  ): Promise<SegmentRefinement | null> {
    return this.backend.readSegmentRefinement(start, end, reason);
  }

  async writeSegmentRefinement(
    start: number,
    end: number,
    reason: string,
    refined: SegmentRefinement,
  ): Promise<void> {
    await this.backend.writeSegmentRefinement(start, end, reason, refined);
    const cacheDir = this.manifestCacheDir;
    if (cacheDir && this.videoId) {
      const hash = computeSegmentRefinementCacheKey(start, end, reason);
      await appendSegmentHash(cacheDir, this.videoId, hash);
    }
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
