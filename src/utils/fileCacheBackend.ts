import { createHash } from 'node:crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { log } from './logger.js';
import {
  TranscriptLineSchema,
  ChunkEvaluationSchema,
  AudioEventSchema,
  SegmentRefinementSchema,
} from '../types/index.js';
import type {
  TranscriptLine,
  LLMChunk,
  ChunkEvaluation,
  AudioEvent,
  SegmentRefinement,
} from '../types/index.js';
import type { CacheBackend } from './cacheBackend.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Serializes audio events into a stable string for cache keying.
 * Events are sorted by time so the key is order-independent.
 */
function audioEventsKey(events: AudioEvent[]): string {
  if (events.length === 0) return '';
  const sorted = [...events].sort((a, b) => a.time - b.time);
  return JSON.stringify(sorted);
}

function hashContent(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function readCacheFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      log.warn(`[cache] Corrupt entry at ${filePath} — ignoring`);
      return null;
    }
    return parsed.data;
  } catch {
    // File not found or unreadable — normal cache miss, stay silent
    return null;
  }
}

async function writeCacheFile(filePath: string, data: unknown): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    log.warn(
      `[cache] Failed to write ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// FileCacheBackend
// ---------------------------------------------------------------------------

/**
 * Disk-backed cache backend. Each cached item is stored as a pretty-printed
 * JSON file under `cacheDir`, named by a SHA-256 hash of the cache key.
 *
 * Directory layout:
 *   <cacheDir>/transcript/<hash>.json
 *   <cacheDir>/chunks/<hash>.json
 *   <cacheDir>/segments/<hash>.json
 *   <cacheDir>/audio/<hash>.json
 */
export class FileCacheBackend implements CacheBackend {
  constructor(private readonly cacheDir: string) {}

  // ---- Transcript -----------------------------------------------------------

  private transcriptPath(videoId: string): string {
    return path.join(this.cacheDir, 'transcript', `${hashContent(videoId)}.json`);
  }

  async readTranscript(videoId: string): Promise<TranscriptLine[] | null> {
    return readCacheFile(this.transcriptPath(videoId), z.array(TranscriptLineSchema));
  }

  async writeTranscript(videoId: string, lines: TranscriptLine[]): Promise<void> {
    await writeCacheFile(this.transcriptPath(videoId), lines);
  }

  // ---- LLM chunk results ----------------------------------------------------

  private chunkPath(chunk: LLMChunk, chunkAudioEvents: AudioEvent[] = []): string {
    const audioKey = audioEventsKey(chunkAudioEvents);
    return path.join(
      this.cacheDir,
      'chunks',
      `${hashContent(`${chunk.start}|${chunk.end}|${chunk.text}|${audioKey}`)}.json`,
    );
  }

  async readChunk(
    chunk: LLMChunk,
    chunkAudioEvents: AudioEvent[] = [],
  ): Promise<ChunkEvaluation | null> {
    return readCacheFile(this.chunkPath(chunk, chunkAudioEvents), ChunkEvaluationSchema);
  }

  async writeChunk(
    chunk: LLMChunk,
    evaluation: ChunkEvaluation,
    chunkAudioEvents: AudioEvent[] = [],
  ): Promise<void> {
    if (evaluation.status !== 'success') return;
    await writeCacheFile(this.chunkPath(chunk, chunkAudioEvents), evaluation);
  }

  // ---- Segment refinement ---------------------------------------------------

  private segmentRefinementPath(start: number, end: number, reason: string): string {
    return path.join(this.cacheDir, 'segments', `${hashContent(`${start}|${end}|${reason}`)}.json`);
  }

  async readSegmentRefinement(
    start: number,
    end: number,
    reason: string,
  ): Promise<SegmentRefinement | null> {
    return readCacheFile(this.segmentRefinementPath(start, end, reason), SegmentRefinementSchema);
  }

  async writeSegmentRefinement(
    start: number,
    end: number,
    reason: string,
    refined: SegmentRefinement,
  ): Promise<void> {
    await writeCacheFile(this.segmentRefinementPath(start, end, reason), refined);
  }

  // ---- Audio events (whole-video) -------------------------------------------

  private audioEventPath(videoId: string, gameProfile: string, provider: string): string {
    return path.join(
      this.cacheDir,
      'audio',
      `${hashContent(`${videoId}|${gameProfile}|${provider}`)}.json`,
    );
  }

  async readAudioEvents(
    videoId: string,
    gameProfile: string,
    provider: string,
  ): Promise<AudioEvent[] | null> {
    return readCacheFile(
      this.audioEventPath(videoId, gameProfile, provider),
      z.array(AudioEventSchema),
    );
  }

  async writeAudioEvents(
    videoId: string,
    gameProfile: string,
    provider: string,
    events: AudioEvent[],
  ): Promise<void> {
    await writeCacheFile(this.audioEventPath(videoId, gameProfile, provider), events);
  }

  // ---- Audio events (per-chunk) ---------------------------------------------

  private audioChunkPath(
    videoId: string,
    gameProfile: string,
    provider: string,
    windowStart: number,
    windowEnd: number,
  ): string {
    return path.join(
      this.cacheDir,
      'audio',
      `${hashContent(`${videoId}|${gameProfile}|${provider}|${windowStart}|${windowEnd}`)}.json`,
    );
  }

  async readAudioChunk(
    videoId: string,
    gameProfile: string,
    provider: string,
    windowStart: number,
    windowEnd: number,
  ): Promise<AudioEvent[] | null> {
    return readCacheFile(
      this.audioChunkPath(videoId, gameProfile, provider, windowStart, windowEnd),
      z.array(AudioEventSchema),
    );
  }

  async writeAudioChunk(
    videoId: string,
    gameProfile: string,
    provider: string,
    windowStart: number,
    windowEnd: number,
    events: AudioEvent[],
  ): Promise<void> {
    await writeCacheFile(
      this.audioChunkPath(videoId, gameProfile, provider, windowStart, windowEnd),
      events,
    );
  }

  // ---- Lifecycle ------------------------------------------------------------

  async close(): Promise<void> {
    // No-op — file handles are not kept open between operations
  }
}
