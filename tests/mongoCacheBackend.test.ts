import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MongoCacheBackend } from '../src/utils/mongoCacheBackend.js';
import type { MongoClient, Db, Collection } from 'mongodb';
import type {
  TranscriptLine,
  LLMChunk,
  ChunkEvaluation,
  AudioEvent,
  SegmentRefinement,
} from '../src/types/index.js';

// ---------------------------------------------------------------------------
// MongoDB mock factory
// ---------------------------------------------------------------------------

/**
 * Builds a minimal mock of MongoClient → Db → Collection that the
 * MongoCacheBackend interacts with.
 *
 * `store` is a simple in-memory map keyed by `cacheKey` so tests can
 * pre-populate it or inspect writes.
 */
function makeMockMongo(store: Map<string, unknown> = new Map()): {
  client: MongoClient;
  collection: ReturnType<typeof makeCollectionMock>;
} {
  const collection = makeCollectionMock(store);

  const db = {
    collection: vi.fn().mockReturnValue(collection),
  } as unknown as Db;

  const client = {
    db: vi.fn().mockReturnValue(db),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as MongoClient;

  return { client, collection };
}

function makeCollectionMock(store: Map<string, unknown>) {
  return {
    createIndex: vi.fn().mockResolvedValue(undefined),
    findOne: vi.fn().mockImplementation(async (filter: { cacheKey: string }) => {
      const entry = store.get(filter.cacheKey);
      if (!entry) return null;
      return { cacheKey: filter.cacheKey, data: entry, createdAt: new Date() };
    }),
    updateOne: vi
      .fn()
      .mockImplementation(
        async (
          filter: { cacheKey: string },
          update: { $set: { cacheKey: string; data: unknown } },
        ) => {
          store.set(update.$set.cacheKey, update.$set.data);
        },
      ),
  } as unknown as Collection;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TRANSCRIPT_LINE: TranscriptLine = { text: 'hello', start: 0, duration: 2 };

const LLM_CHUNK: LLMChunk = { start: 0, end: 120, text: 'some text' };

const SUCCESS_EVAL: ChunkEvaluation = {
  status: 'success',
  chunk_index: 0,
  chunk_start: 0,
  chunk_end: 120,
  interesting: true,
  score: 8,
  reason: 'great moment',
  clip_start: 10,
  clip_end: 40,
};

const FAILED_EVAL: ChunkEvaluation = {
  status: 'failed',
  chunk_index: 0,
  chunk_start: 0,
  chunk_end: 120,
  error: 'timeout',
};

const AUDIO_EVENT: AudioEvent = {
  time: 30,
  event: 'gunshot',
  confidence: 0.9,
  source: 'gemini',
};

const SEGMENT_REFINEMENT: SegmentRefinement = {
  refined_start: 12,
  refined_end: 58,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MongoCacheBackend', () => {
  let store: Map<string, unknown>;
  let backend: MongoCacheBackend;
  let client: MongoClient;
  let collection: ReturnType<typeof makeCollectionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new Map();
    ({ client, collection } = makeMockMongo(store));
    backend = new MongoCacheBackend(client, 'test-db', 0);
  });

  // ── Transcript ─────────────────────────────────────────────────────────────

  describe('transcript', () => {
    it('returns null on cache miss', async () => {
      expect(await backend.readTranscript('vid123')).toBeNull();
    });

    it('round-trips transcript lines', async () => {
      const lines: TranscriptLine[] = [TRANSCRIPT_LINE];
      await backend.writeTranscript('vid123', lines);
      const result = await backend.readTranscript('vid123');
      expect(result).toEqual(lines);
    });

    it('different video IDs are independent', async () => {
      const lines1 = [TRANSCRIPT_LINE];
      const lines2 = [{ text: 'other', start: 5, duration: 1 }];
      await backend.writeTranscript('aaaa', lines1);
      await backend.writeTranscript('bbbb', lines2);
      expect(await backend.readTranscript('aaaa')).toEqual(lines1);
      expect(await backend.readTranscript('bbbb')).toEqual(lines2);
    });

    it('returns null for corrupt data (zod validation)', async () => {
      collection.findOne = vi
        .fn()
        .mockResolvedValue({ cacheKey: 'k', data: { not: 'a transcript' }, createdAt: new Date() });
      expect(await backend.readTranscript('vid123')).toBeNull();
    });
  });

  // ── LLM chunk results ──────────────────────────────────────────────────────

  describe('chunk evaluations', () => {
    it('returns null on cache miss', async () => {
      expect(await backend.readChunk(LLM_CHUNK)).toBeNull();
    });

    it('round-trips a successful evaluation', async () => {
      await backend.writeChunk(LLM_CHUNK, SUCCESS_EVAL);
      const result = await backend.readChunk(LLM_CHUNK);
      expect(result).toEqual(SUCCESS_EVAL);
    });

    it('does not write failed evaluations', async () => {
      await backend.writeChunk(LLM_CHUNK, FAILED_EVAL);
      expect(collection.updateOne).not.toHaveBeenCalled();
      expect(await backend.readChunk(LLM_CHUNK)).toBeNull();
    });

    it('different chunks (different text) are independent', async () => {
      const chunk2: LLMChunk = { ...LLM_CHUNK, text: 'different text' };
      const eval2: ChunkEvaluation = { ...SUCCESS_EVAL, score: 5 };
      await backend.writeChunk(LLM_CHUNK, SUCCESS_EVAL);
      await backend.writeChunk(chunk2, eval2);
      expect(await backend.readChunk(LLM_CHUNK)).toEqual(SUCCESS_EVAL);
      expect(await backend.readChunk(chunk2)).toEqual(eval2);
    });

    it('returns null for corrupt chunk data', async () => {
      collection.findOne = vi
        .fn()
        .mockResolvedValue({ cacheKey: 'k', data: { garbage: true }, createdAt: new Date() });
      expect(await backend.readChunk(LLM_CHUNK)).toBeNull();
    });
  });

  // ── Segment refinement ─────────────────────────────────────────────────────

  describe('segment refinement', () => {
    it('returns null on cache miss', async () => {
      expect(await backend.readSegmentRefinement(10, 40, 'great moment')).toBeNull();
    });

    it('round-trips a segment refinement', async () => {
      await backend.writeSegmentRefinement(10, 40, 'great moment', SEGMENT_REFINEMENT);
      const result = await backend.readSegmentRefinement(10, 40, 'great moment');
      expect(result).toEqual(SEGMENT_REFINEMENT);
    });

    it('different keys are independent', async () => {
      const ref2: SegmentRefinement = { refined_start: 20, refined_end: 80 };
      await backend.writeSegmentRefinement(10, 40, 'great moment', SEGMENT_REFINEMENT);
      await backend.writeSegmentRefinement(20, 80, 'other reason', ref2);
      expect(await backend.readSegmentRefinement(10, 40, 'great moment')).toEqual(
        SEGMENT_REFINEMENT,
      );
      expect(await backend.readSegmentRefinement(20, 80, 'other reason')).toEqual(ref2);
    });
  });

  // ── Audio events (whole-video) ─────────────────────────────────────────────

  describe('audio events', () => {
    it('returns null on cache miss', async () => {
      expect(await backend.readAudioEvents('vid123', 'fps', 'gemini')).toBeNull();
    });

    it('round-trips audio events', async () => {
      const events = [AUDIO_EVENT];
      await backend.writeAudioEvents('vid123', 'fps', 'gemini', events);
      const result = await backend.readAudioEvents('vid123', 'fps', 'gemini');
      expect(result).toEqual(events);
    });

    it('different game profiles are independent', async () => {
      const events1 = [AUDIO_EVENT];
      const events2 = [
        { time: 60, event: 'explosion', confidence: 0.7, source: 'yamnet' as const },
      ];
      await backend.writeAudioEvents('vid123', 'fps', 'gemini', events1);
      await backend.writeAudioEvents('vid123', 'valorant', 'gemini', events2);
      expect(await backend.readAudioEvents('vid123', 'fps', 'gemini')).toEqual(events1);
      expect(await backend.readAudioEvents('vid123', 'valorant', 'gemini')).toEqual(events2);
    });
  });

  // ── Audio events (per-chunk) ───────────────────────────────────────────────

  describe('audio chunks', () => {
    it('returns null on cache miss', async () => {
      expect(await backend.readAudioChunk('vid123', 'fps', 'gemini', 0, 30)).toBeNull();
    });

    it('round-trips audio chunk events', async () => {
      const events = [AUDIO_EVENT];
      await backend.writeAudioChunk('vid123', 'fps', 'gemini', 0, 30, events);
      const result = await backend.readAudioChunk('vid123', 'fps', 'gemini', 0, 30);
      expect(result).toEqual(events);
    });

    it('different windows are independent', async () => {
      const events1 = [AUDIO_EVENT];
      const events2 = [
        { time: 60, event: 'explosion', confidence: 0.7, source: 'yamnet' as const },
      ];
      await backend.writeAudioChunk('vid123', 'fps', 'gemini', 0, 30, events1);
      await backend.writeAudioChunk('vid123', 'fps', 'gemini', 30, 60, events2);
      expect(await backend.readAudioChunk('vid123', 'fps', 'gemini', 0, 30)).toEqual(events1);
      expect(await backend.readAudioChunk('vid123', 'fps', 'gemini', 30, 60)).toEqual(events2);
    });
  });

  // ── Index creation ─────────────────────────────────────────────────────────

  describe('index creation', () => {
    it('creates only unique index when ttlSeconds = 0', async () => {
      await backend.writeTranscript('vid123', [TRANSCRIPT_LINE]);
      // createIndex called once: unique cacheKey index only
      expect(collection.createIndex).toHaveBeenCalledTimes(1);
      expect(collection.createIndex).toHaveBeenCalledWith({ cacheKey: 1 }, { unique: true });
    });

    it('creates TTL index when ttlSeconds > 0', async () => {
      const ttlBackend = new MongoCacheBackend(client, 'test-db', 3600);
      await ttlBackend.writeTranscript('vid123', [TRANSCRIPT_LINE]);
      // createIndex called twice: cacheKey index + TTL index
      expect(collection.createIndex).toHaveBeenCalledTimes(2);
      expect(collection.createIndex).toHaveBeenCalledWith(
        { createdAt: 1 },
        { expireAfterSeconds: 3600 },
      );
    });

    it('does not re-create indexes on subsequent accesses to same collection', async () => {
      await backend.writeTranscript('vid1', [TRANSCRIPT_LINE]);
      await backend.writeTranscript('vid2', [TRANSCRIPT_LINE]);
      // Still only called once even after two accesses to same collection
      expect(collection.createIndex).toHaveBeenCalledTimes(1);
    });
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  describe('close()', () => {
    it('calls client.close()', async () => {
      await backend.close();
      expect(client.close).toHaveBeenCalledTimes(1);
    });
  });

  // ── Error resilience ───────────────────────────────────────────────────────

  describe('error resilience', () => {
    it('returns null (not throws) when findOne rejects', async () => {
      collection.findOne = vi.fn().mockRejectedValue(new Error('network error'));
      expect(await backend.readTranscript('vid123')).toBeNull();
    });

    it('does not throw when updateOne rejects', async () => {
      collection.updateOne = vi.fn().mockRejectedValue(new Error('write error'));
      await expect(backend.writeTranscript('vid123', [TRANSCRIPT_LINE])).resolves.toBeUndefined();
    });
  });
});
