import { createHash } from 'node:crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { log } from '@lib/utils/logger.js';
import { TranscriptLineSchema, AudioEventSchema } from '@lib/types/index.js';
import type { TranscriptLine, AudioEvent } from '@lib/types/index.js';
import type { CacheBackend } from '@lib/types/cache.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hashContent(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function computeVideoCacheKey(videoId: string): string {
  return hashContent(videoId);
}

async function readCacheFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      log.warn('FileCacheBackend', `[cache] Corrupt entry at ${filePath} — ignoring`);
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
      'FileCacheBackend',
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
 *   <cacheDir>/audio/<hash>.json
 */
export class FileCacheBackend implements CacheBackend {
  constructor(public readonly cacheDir: string) {}

  // ---- Transcript -----------------------------------------------------------

  private transcriptPath(videoId: string): string {
    return path.join(this.cacheDir, 'transcript', `${computeVideoCacheKey(videoId)}.json`);
  }

  async readTranscript(videoId: string): Promise<TranscriptLine[] | null> {
    return readCacheFile(this.transcriptPath(videoId), z.array(TranscriptLineSchema));
  }

  async writeTranscript(videoId: string, lines: TranscriptLine[]): Promise<void> {
    await writeCacheFile(this.transcriptPath(videoId), lines);
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
