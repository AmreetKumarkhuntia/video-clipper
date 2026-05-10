import type {
  TranscriptLine,
  LLMChunk,
  ChunkEvaluation,
  AudioEvent,
  SegmentRefinement,
} from '@lib/types/index.js';
import type { CacheBackend } from '@lib/types/cache.js';

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
