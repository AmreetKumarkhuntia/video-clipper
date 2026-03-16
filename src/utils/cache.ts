import { createHash } from 'node:crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { log } from './logger.js';
import { TranscriptLineSchema } from '../types/index.js';
import { ChunkEvaluationSchema } from '../types/index.js';
import { AudioEventSchema } from '../types/index.js';
import type { TranscriptLine, LLMChunk, ChunkEvaluation, AudioEvent } from '../types/index.js';

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
  log.info(`Caching successful evaluation for chunk [${chunk.start}, ${chunk.end}] at ${filePath}`);
  await writeCacheFile(filePath, evaluation);
}

// ---------------------------------------------------------------------------
// Segment refinement cache
//   Key  : sha256(segment.start + '|' + segment.end + '|' + segment.reason)
//   Value: { refined_start: number, refined_end: number }
// ---------------------------------------------------------------------------

function segmentRefinementCachePath(
  start: number,
  end: number,
  reason: string,
  cacheDir: string,
): string {
  const key = `${start}|${end}|${reason}`;
  return path.join(cacheDir, 'segments', `${hashContent(key)}.json`);
}

const SegmentRefinementSchema = z.object({
  refined_start: z.number(),
  refined_end: z.number(),
});
type SegmentRefinement = z.infer<typeof SegmentRefinementSchema>;

/**
 * Returns cached refined boundaries for a segment, or `null` on a cache miss.
 */
export async function readSegmentRefinementCache(
  start: number,
  end: number,
  reason: string,
  cacheDir: string,
): Promise<SegmentRefinement | null> {
  const filePath = segmentRefinementCachePath(start, end, reason, cacheDir);
  return readCacheFile(filePath, SegmentRefinementSchema);
}

/**
 * Persists refined segment boundaries to disk.
 */
export async function writeSegmentRefinementCache(
  start: number,
  end: number,
  reason: string,
  refined: SegmentRefinement,
  cacheDir: string,
): Promise<void> {
  const filePath = segmentRefinementCachePath(start, end, reason, cacheDir);
  log.info(`Caching segment refinement [${start}, ${end}] at ${filePath}`);
  await writeCacheFile(filePath, refined);
}

// ---------------------------------------------------------------------------
// Audio event cache
//   Key  : sha256(videoId + '|' + gameProfile + '|' + provider)
//   Value: AudioEvent[]
// ---------------------------------------------------------------------------

function audioEventCachePath(
  videoId: string,
  gameProfile: string,
  provider: string,
  cacheDir: string,
): string {
  const key = `${videoId}|${gameProfile}|${provider}`;
  return path.join(cacheDir, 'audio', `${hashContent(key)}.json`);
}

/**
 * Returns cached audio events for a videoId/gameProfile/provider combination, or null on miss.
 */
export async function readAudioEventCache(
  videoId: string,
  gameProfile: string,
  provider: string,
  cacheDir: string,
): Promise<AudioEvent[] | null> {
  const filePath = audioEventCachePath(videoId, gameProfile, provider, cacheDir);
  return readCacheFile(filePath, z.array(AudioEventSchema));
}

/**
 * Persists audio events to disk.
 */
export async function writeAudioEventCache(
  videoId: string,
  gameProfile: string,
  provider: string,
  events: AudioEvent[],
  cacheDir: string,
): Promise<void> {
  const filePath = audioEventCachePath(videoId, gameProfile, provider, cacheDir);
  log.info(`Caching ${events.length} audio events for ${videoId} at ${filePath}`);
  await writeCacheFile(filePath, events);
}
