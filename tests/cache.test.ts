import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { Cache } from '../src/utils/cache.js';
import type { TranscriptLine, LLMChunk, ChunkEvaluation, AudioEvent } from '../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpDir(): string {
  return path.join(os.tmpdir(), `cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

const TRANSCRIPT_LINE: TranscriptLine = { text: 'hello world', start: 0, duration: 2 };

const LLM_CHUNK: LLMChunk = {
  start: 0,
  end: 120,
  text: 'some transcript text',
};

const CHUNK_EVALUATION: ChunkEvaluation = {
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

const AUDIO_EVENT: AudioEvent = {
  time: 30,
  event: 'gunshot',
  confidence: 0.9,
  source: 'gemini',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cache', () => {
  let cacheDir: string;
  let cache: Cache;

  beforeEach(async () => {
    cacheDir = tmpDir();
    await fs.mkdir(cacheDir, { recursive: true });
    cache = new Cache(cacheDir);
  });

  afterEach(async () => {
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  // ── Transcript ────────────────────────────────────────────────────────────

  describe('transcript', () => {
    it('returns null on cache miss', async () => {
      const result = await cache.readTranscript('abc12345678');
      expect(result).toBeNull();
    });

    it('round-trips transcript lines', async () => {
      const lines: TranscriptLine[] = [TRANSCRIPT_LINE, { text: 'bye', start: 3, duration: 1 }];
      await cache.writeTranscript('abc12345678', lines);
      const loaded = await cache.readTranscript('abc12345678');
      expect(loaded).toEqual(lines);
    });

    it('different video IDs have independent entries', async () => {
      const lines1: TranscriptLine[] = [TRANSCRIPT_LINE];
      const lines2: TranscriptLine[] = [{ text: 'other', start: 5, duration: 1 }];
      await cache.writeTranscript('aaaaaaaaaaa', lines1);
      await cache.writeTranscript('bbbbbbbbbbb', lines2);

      expect(await cache.readTranscript('aaaaaaaaaaa')).toEqual(lines1);
      expect(await cache.readTranscript('bbbbbbbbbbb')).toEqual(lines2);
    });
  });

  // ── LLM chunk results ─────────────────────────────────────────────────────

  describe('chunk evaluations', () => {
    it('returns null on cache miss', async () => {
      expect(await cache.readChunk(LLM_CHUNK)).toBeNull();
    });

    it('round-trips a successful evaluation', async () => {
      await cache.writeChunk(LLM_CHUNK, CHUNK_EVALUATION);
      const loaded = await cache.readChunk(LLM_CHUNK);
      expect(loaded).toEqual(CHUNK_EVALUATION);
    });

    it('does not write failed evaluations', async () => {
      const failed: ChunkEvaluation = {
        status: 'failed',
        chunk_index: 0,
        chunk_start: 0,
        chunk_end: 120,
        error: 'timeout',
      };
      await cache.writeChunk(LLM_CHUNK, failed);
      expect(await cache.readChunk(LLM_CHUNK)).toBeNull();
    });

    it('different chunks (different text) are independent', async () => {
      const chunk2: LLMChunk = { ...LLM_CHUNK, text: 'different text' };
      const eval2: ChunkEvaluation = { ...CHUNK_EVALUATION, score: 5 };

      await cache.writeChunk(LLM_CHUNK, CHUNK_EVALUATION);
      await cache.writeChunk(chunk2, eval2);

      expect(await cache.readChunk(LLM_CHUNK)).toEqual(CHUNK_EVALUATION);
      expect(await cache.readChunk(chunk2)).toEqual(eval2);
    });
  });

  // ── Audio events ──────────────────────────────────────────────────────────

  describe('audio events', () => {
    it('returns null on cache miss', async () => {
      expect(await cache.readAudioEvents('abc12345678', 'fps', 'gemini')).toBeNull();
    });

    it('round-trips audio events', async () => {
      const events: AudioEvent[] = [AUDIO_EVENT];
      await cache.writeAudioEvents('abc12345678', 'fps', 'gemini', events);
      const loaded = await cache.readAudioEvents('abc12345678', 'fps', 'gemini');
      expect(loaded).toEqual(events);
    });

    it('different game profiles are independent', async () => {
      const events1: AudioEvent[] = [AUDIO_EVENT];
      const events2: AudioEvent[] = [
        { time: 60, event: 'explosion', confidence: 0.7, source: 'yamnet' },
      ];

      await cache.writeAudioEvents('abc12345678', 'fps', 'gemini', events1);
      await cache.writeAudioEvents('abc12345678', 'valorant', 'gemini', events2);

      expect(await cache.readAudioEvents('abc12345678', 'fps', 'gemini')).toEqual(events1);
      expect(await cache.readAudioEvents('abc12345678', 'valorant', 'gemini')).toEqual(events2);
    });
  });

  // ── Disabled mode (--no-cache) ────────────────────────────────────────────

  describe('disabled cache', () => {
    let disabledCache: Cache;

    beforeEach(() => {
      disabledCache = new Cache(cacheDir, true);
    });

    it('always returns null for reads', async () => {
      // pre-write with enabled cache to confirm disabled cache ignores it
      await cache.writeTranscript('abc12345678', [TRANSCRIPT_LINE]);
      expect(await disabledCache.readTranscript('abc12345678')).toBeNull();
    });

    it('silently skips writes', async () => {
      // No error thrown, file is not written
      await disabledCache.writeTranscript('abc12345678', [TRANSCRIPT_LINE]);
      expect(await cache.readTranscript('abc12345678')).toBeNull();
    });

    it('returns null for chunk reads', async () => {
      await cache.writeChunk(LLM_CHUNK, CHUNK_EVALUATION);
      expect(await disabledCache.readChunk(LLM_CHUNK)).toBeNull();
    });

    it('returns null for audio event reads', async () => {
      await cache.writeAudioEvents('abc12345678', 'fps', 'gemini', [AUDIO_EVENT]);
      expect(await disabledCache.readAudioEvents('abc12345678', 'fps', 'gemini')).toBeNull();
    });
  });

  // ── Corrupt cache handling ────────────────────────────────────────────────

  describe('corrupt cache entries', () => {
    it('returns null and does not throw for corrupt transcript JSON', async () => {
      const corruptPath = path.join(cacheDir, 'transcript');
      await fs.mkdir(corruptPath, { recursive: true });
      // Write a file that will match the expected hash path
      const hash = await getTranscriptHash('abc12345678');
      await fs.writeFile(path.join(corruptPath, `${hash}.json`), 'NOT VALID JSON', 'utf-8');

      expect(await cache.readTranscript('abc12345678')).toBeNull();
    });
  });
});

// Helper: compute the same sha256 hash the Cache class uses internally
async function getTranscriptHash(videoId: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(videoId).digest('hex');
}
