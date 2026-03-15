import { createHash } from 'node:crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { log } from './logger.js';
import { TranscriptLineSchema } from '../types/index.js';
import { ChunkEvaluationSchema } from '../types/index.js';
import type { TranscriptLine, LLMChunk, ChunkEvaluation } from '../types/index.js';

// ---------------------------------------------------------------------------
// Generic hash helper
// ---------------------------------------------------------------------------

/**
 * Returns the hex SHA-256 digest of an arbitrary string.
 */
export function hashContent(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// ---------------------------------------------------------------------------
// Generic disk read/write helpers
// ---------------------------------------------------------------------------

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
// Transcript cache
//   Key  : sha256(videoId)
//   Value: TranscriptLine[]
// ---------------------------------------------------------------------------

function transcriptCachePath(videoId: string, cacheDir: string): string {
  return path.join(cacheDir, 'transcript', `${hashContent(videoId)}.json`);
}

/**
 * Returns cached transcript lines for `videoId`, or `null` on a cache miss.
 */
export async function readTranscriptCache(
  videoId: string,
  cacheDir: string,
): Promise<TranscriptLine[] | null> {
  const filePath = transcriptCachePath(videoId, cacheDir);
  return readCacheFile(filePath, z.array(TranscriptLineSchema));
}

/**
 * Persists `lines` to the transcript cache for `videoId`.
 */
export async function writeTranscriptCache(
  videoId: string,
  lines: TranscriptLine[],
  cacheDir: string,
): Promise<void> {
  const filePath = transcriptCachePath(videoId, cacheDir);
  await writeCacheFile(filePath, lines);
}

// ---------------------------------------------------------------------------
// Chunk LLM-result cache
//   Key  : sha256(chunk.start + '|' + chunk.end + '|' + chunk.text)
//   Value: ChunkEvaluation (status === 'success' only)
// ---------------------------------------------------------------------------

function chunkCachePath(chunk: LLMChunk, cacheDir: string): string {
  const key = `${chunk.start}|${chunk.end}|${chunk.text}`;
  return path.join(cacheDir, 'chunks', `${hashContent(key)}.json`);
}

/**
 * Returns the cached `ChunkEvaluation` for a chunk, or `null` on a cache miss.
 * Only successful evaluations are ever stored, so a hit always returns status 'success'.
 */
export async function readChunkCache(
  chunk: LLMChunk,
  cacheDir: string,
): Promise<ChunkEvaluation | null> {
  const filePath = chunkCachePath(chunk, cacheDir);
  return readCacheFile(filePath, ChunkEvaluationSchema);
}

/**
 * Persists a successful `ChunkEvaluation` to disk.
 * Silently ignores failed evaluations — those should be retried on the next run.
 */
export async function writeChunkCache(
  chunk: LLMChunk,
  evaluation: ChunkEvaluation,
  cacheDir: string,
): Promise<void> {
  if (evaluation.status !== 'success') return;
  const filePath = chunkCachePath(chunk, cacheDir);
  await writeCacheFile(filePath, evaluation);
}
