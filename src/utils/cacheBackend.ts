import type {
  TranscriptLine,
  LLMChunk,
  ChunkEvaluation,
  AudioEvent,
  SegmentRefinement,
} from '../types/index.js';

/**
 * Common interface implemented by every cache backend (file-based, MongoDB, etc.).
 *
 * All read methods return null on a cache miss or any read error.
 * All write methods are fire-and-forget — failures are logged but never thrown.
 * `close()` releases any underlying resources (connections, file handles, etc.).
 */
export interface CacheBackend {
  // ---- Transcript -----------------------------------------------------------
  readTranscript(videoId: string): Promise<TranscriptLine[] | null>;
  writeTranscript(videoId: string, lines: TranscriptLine[]): Promise<void>;

  // ---- LLM chunk results ----------------------------------------------------
  readChunk(chunk: LLMChunk, chunkAudioEvents?: AudioEvent[]): Promise<ChunkEvaluation | null>;
  writeChunk(
    chunk: LLMChunk,
    evaluation: ChunkEvaluation,
    chunkAudioEvents?: AudioEvent[],
  ): Promise<void>;

  // ---- Segment refinement ---------------------------------------------------
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

  // ---- Audio events (whole-video) -------------------------------------------
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

  // ---- Audio events (per-chunk) ---------------------------------------------
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

  // ---- Lifecycle ------------------------------------------------------------
  /** Release any underlying resources (DB connections, file handles, etc.). */
  close(): Promise<void>;
}

/**
 * No-op backend used when the cache is disabled (--no-cache flag).
 * All reads return null; all writes are silent no-ops.
 */
export class DisabledCacheBackend implements CacheBackend {
  async readTranscript(_videoId: string): Promise<TranscriptLine[] | null> {
    return null;
  }
  async writeTranscript(_videoId: string, _lines: TranscriptLine[]): Promise<void> {}

  async readChunk(
    _chunk: LLMChunk,
    _chunkAudioEvents?: AudioEvent[],
  ): Promise<ChunkEvaluation | null> {
    return null;
  }
  async writeChunk(
    _chunk: LLMChunk,
    _evaluation: ChunkEvaluation,
    _chunkAudioEvents?: AudioEvent[],
  ): Promise<void> {}

  async readSegmentRefinement(
    _start: number,
    _end: number,
    _reason: string,
  ): Promise<SegmentRefinement | null> {
    return null;
  }
  async writeSegmentRefinement(
    _start: number,
    _end: number,
    _reason: string,
    _refined: SegmentRefinement,
  ): Promise<void> {}

  async readAudioEvents(
    _videoId: string,
    _gameProfile: string,
    _provider: string,
  ): Promise<AudioEvent[] | null> {
    return null;
  }
  async writeAudioEvents(
    _videoId: string,
    _gameProfile: string,
    _provider: string,
    _events: AudioEvent[],
  ): Promise<void> {}

  async readAudioChunk(
    _videoId: string,
    _gameProfile: string,
    _provider: string,
    _windowStart: number,
    _windowEnd: number,
  ): Promise<AudioEvent[] | null> {
    return null;
  }
  async writeAudioChunk(
    _videoId: string,
    _gameProfile: string,
    _provider: string,
    _windowStart: number,
    _windowEnd: number,
    _events: AudioEvent[],
  ): Promise<void> {}

  async close(): Promise<void> {}
}
