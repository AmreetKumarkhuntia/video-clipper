import { createHash } from 'node:crypto';
import type { MongoClient } from 'mongodb';
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
// Document shape stored in every MongoDB collection
// ---------------------------------------------------------------------------

interface CacheDocument<T> {
  /** SHA-256 hex digest of the composite cache key. Used as the unique index. */
  cacheKey: string;
  /** The cached payload, stored as a plain object. */
  data: T;
  /** ISO date of insertion — used by the TTL index. */
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hashContent(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Serializes audio events into a stable string for cache keying.
 * Events are sorted by time so the key is order-independent.
 */
function audioEventsKey(events: AudioEvent[]): string {
  if (events.length === 0) return '';
  const sorted = [...events].sort((a, b) => a.time - b.time);
  return JSON.stringify(sorted);
}

// ---------------------------------------------------------------------------
// MongoCacheBackend
// ---------------------------------------------------------------------------

/**
 * MongoDB-backed cache backend.
 *
 * Each cache category maps to one collection. Documents have the shape:
 *   { cacheKey: string, data: <payload>, createdAt: Date }
 *
 * Indexes created on first use (idempotent):
 *   - Unique index on `cacheKey` for O(1) lookups
 *   - TTL index on `createdAt` when `ttlSeconds > 0`
 *
 * All reads validate the stored payload through the same zod schemas used by
 * the file backend, giving identical runtime safety guarantees.
 *
 * Pass `ttlSeconds = 0` (or omit) to disable TTL expiration.
 */
export class MongoCacheBackend implements CacheBackend {
  private readonly db;
  private readonly ttlSeconds: number;
  /** Track which collections already have their indexes created this session. */
  private readonly indexedCollections = new Set<string>();

  constructor(
    private readonly client: MongoClient,
    databaseName: string,
    ttlSeconds = 0,
  ) {
    this.db = client.db(databaseName);
    this.ttlSeconds = ttlSeconds;
  }

  // ---------------------------------------------------------------------------
  // Index management
  // ---------------------------------------------------------------------------

  /**
   * Ensures indexes exist for a collection. Called lazily on first access per
   * collection name. `createIndex` is idempotent so concurrent calls are safe.
   */
  private async ensureIndexes(collectionName: string): Promise<void> {
    if (this.indexedCollections.has(collectionName)) return;
    try {
      const col = this.db.collection(collectionName);
      // Unique index for O(1) cache key lookups
      await col.createIndex({ cacheKey: 1 }, { unique: true });
      // TTL index — only when a positive TTL is configured
      if (this.ttlSeconds > 0) {
        await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: this.ttlSeconds });
      }
      this.indexedCollections.add(collectionName);
    } catch (err) {
      // Non-fatal — pipeline should not crash if indexes can't be created
      log.warn(
        `[mongo-cache] Failed to ensure indexes on "${collectionName}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Low-level read / write helpers
  // ---------------------------------------------------------------------------

  private async readDoc<T>(
    collectionName: string,
    cacheKey: string,
    schema: z.ZodType<T>,
  ): Promise<T | null> {
    try {
      await this.ensureIndexes(collectionName);
      const col = this.db.collection<CacheDocument<unknown>>(collectionName);
      const doc = await col.findOne({ cacheKey });
      if (!doc) return null;

      const parsed = schema.safeParse(doc.data);
      if (!parsed.success) {
        log.warn(`[mongo-cache] Corrupt entry in "${collectionName}" (key=${cacheKey}) — ignoring`);
        return null;
      }
      return parsed.data;
    } catch (err) {
      log.warn(
        `[mongo-cache] Read failed in "${collectionName}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async writeDoc(collectionName: string, cacheKey: string, data: unknown): Promise<void> {
    try {
      await this.ensureIndexes(collectionName);
      const col = this.db.collection(collectionName);
      await col.updateOne(
        { cacheKey },
        { $set: { cacheKey, data, createdAt: new Date() } },
        { upsert: true },
      );
    } catch (err) {
      log.warn(
        `[mongo-cache] Write failed in "${collectionName}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Transcript
  // ---------------------------------------------------------------------------

  private static readonly TRANSCRIPTS = 'transcripts';

  async readTranscript(videoId: string): Promise<TranscriptLine[] | null> {
    return this.readDoc(
      MongoCacheBackend.TRANSCRIPTS,
      hashContent(videoId),
      z.array(TranscriptLineSchema),
    );
  }

  async writeTranscript(videoId: string, lines: TranscriptLine[]): Promise<void> {
    await this.writeDoc(MongoCacheBackend.TRANSCRIPTS, hashContent(videoId), lines);
  }

  // ---------------------------------------------------------------------------
  // LLM chunk results
  // ---------------------------------------------------------------------------

  private static readonly CHUNKS = 'chunkEvaluations';

  private chunkKey(chunk: LLMChunk, chunkAudioEvents: AudioEvent[] = []): string {
    const audioKey = audioEventsKey(chunkAudioEvents);
    return hashContent(`${chunk.start}|${chunk.end}|${chunk.text}|${audioKey}`);
  }

  async readChunk(
    chunk: LLMChunk,
    chunkAudioEvents: AudioEvent[] = [],
  ): Promise<ChunkEvaluation | null> {
    return this.readDoc(
      MongoCacheBackend.CHUNKS,
      this.chunkKey(chunk, chunkAudioEvents),
      ChunkEvaluationSchema,
    );
  }

  async writeChunk(
    chunk: LLMChunk,
    evaluation: ChunkEvaluation,
    chunkAudioEvents: AudioEvent[] = [],
  ): Promise<void> {
    // Only cache successful evaluations — mirrors the file backend behaviour
    if (evaluation.status !== 'success') return;
    await this.writeDoc(
      MongoCacheBackend.CHUNKS,
      this.chunkKey(chunk, chunkAudioEvents),
      evaluation,
    );
  }

  // ---------------------------------------------------------------------------
  // Segment refinement
  // ---------------------------------------------------------------------------

  private static readonly SEGMENTS = 'segmentRefinements';

  async readSegmentRefinement(
    start: number,
    end: number,
    reason: string,
  ): Promise<SegmentRefinement | null> {
    return this.readDoc(
      MongoCacheBackend.SEGMENTS,
      hashContent(`${start}|${end}|${reason}`),
      SegmentRefinementSchema,
    );
  }

  async writeSegmentRefinement(
    start: number,
    end: number,
    reason: string,
    refined: SegmentRefinement,
  ): Promise<void> {
    await this.writeDoc(
      MongoCacheBackend.SEGMENTS,
      hashContent(`${start}|${end}|${reason}`),
      refined,
    );
  }

  // ---------------------------------------------------------------------------
  // Audio events (whole-video)
  // ---------------------------------------------------------------------------

  private static readonly AUDIO_EVENTS = 'audioEvents';

  async readAudioEvents(
    videoId: string,
    gameProfile: string,
    provider: string,
  ): Promise<AudioEvent[] | null> {
    return this.readDoc(
      MongoCacheBackend.AUDIO_EVENTS,
      hashContent(`${videoId}|${gameProfile}|${provider}`),
      z.array(AudioEventSchema),
    );
  }

  async writeAudioEvents(
    videoId: string,
    gameProfile: string,
    provider: string,
    events: AudioEvent[],
  ): Promise<void> {
    await this.writeDoc(
      MongoCacheBackend.AUDIO_EVENTS,
      hashContent(`${videoId}|${gameProfile}|${provider}`),
      events,
    );
  }

  // ---------------------------------------------------------------------------
  // Audio events (per-chunk)
  // ---------------------------------------------------------------------------

  private static readonly AUDIO_CHUNKS = 'audioChunks';

  async readAudioChunk(
    videoId: string,
    gameProfile: string,
    provider: string,
    windowStart: number,
    windowEnd: number,
  ): Promise<AudioEvent[] | null> {
    return this.readDoc(
      MongoCacheBackend.AUDIO_CHUNKS,
      hashContent(`${videoId}|${gameProfile}|${provider}|${windowStart}|${windowEnd}`),
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
    await this.writeDoc(
      MongoCacheBackend.AUDIO_CHUNKS,
      hashContent(`${videoId}|${gameProfile}|${provider}|${windowStart}|${windowEnd}`),
      events,
    );
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async close(): Promise<void> {
    try {
      await this.client.close();
    } catch (err) {
      log.warn(
        `[mongo-cache] Failed to close MongoDB connection: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
