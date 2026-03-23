import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMAnalyzer } from '../src/services/llmAnalyzer/LLMAnalyzer.js';
import type { TranscriptDetector } from '../src/services/transcriptDetector/index.js';
import type { Cache } from '../src/utils/cache.js';
import type {
  TranscriptLine,
  MicroBlock,
  LLMChunk,
  ChunkEvaluation,
  RankedSegment,
} from '../src/types/index.js';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that touch these modules
// ---------------------------------------------------------------------------

vi.mock('../src/services/llmAnalyzer/index.js', () => ({
  analyzeChunks: vi.fn(),
}));

vi.mock('../src/services/clipRefiner/index.js', () => ({
  refineSegments: vi.fn(),
}));

// Import the mocked free functions so we can configure them per test
import { analyzeChunks } from '../src/services/llmAnalyzer/index.js';
import { refineSegments } from '../src/services/clipRefiner/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LINES: TranscriptLine[] = [
  { text: 'Hello world', start: 0, duration: 2 },
  { text: 'Second line', start: 2, duration: 2 },
];

const MICRO_BLOCKS: MicroBlock[] = [{ text: 'Hello world Second line', start: 0, end: 15 }];

const CHUNKS: LLMChunk[] = [{ text: 'Hello world Second line', start: 0, end: 120 }];

const SUCCESS_EVAL: ChunkEvaluation = {
  status: 'success',
  chunk_index: 0,
  chunk_start: 0,
  chunk_end: 120,
  interesting: true,
  score: 8,
  reason: 'great moment',
  clip_start: 10,
  clip_end: 60,
};

const RANKED_SEGMENT: RankedSegment = {
  start: 10,
  end: 60,
  score: 8,
  rank: 1,
  reason: 'great moment',
  source: 'transcript',
};

// ---------------------------------------------------------------------------
// Stub builders
// ---------------------------------------------------------------------------

function makeTranscriptDetector(
  result: { lines: TranscriptLine[]; microBlocks: MicroBlock[]; chunks: LLMChunk[] } | Error,
): TranscriptDetector {
  return {
    detect: vi
      .fn()
      .mockImplementation(() =>
        result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
      ),
  } as unknown as TranscriptDetector;
}

function makeCache(): Cache {
  return {} as unknown as Cache;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LLMAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── analyze() ─────────────────────────────────────────────────────────────

  describe('analyze()', () => {
    it('returns lines, microBlocks, chunks, and chunkEvals on success', async () => {
      const detector = makeTranscriptDetector({
        lines: LINES,
        microBlocks: MICRO_BLOCKS,
        chunks: CHUNKS,
      });
      vi.mocked(analyzeChunks).mockResolvedValue([SUCCESS_EVAL]);

      const analyzer = new LLMAnalyzer(detector, makeCache());
      const result = await analyzer.analyze({
        videoId: 'abc123',
        audioPath: null,
        audioEvents: [],
        maxParallel: 3,
        noCache: true,
      });

      expect(result.lines).toEqual(LINES);
      expect(result.microBlocks).toEqual(MICRO_BLOCKS);
      expect(result.chunks).toEqual(CHUNKS);
      expect(result.chunkEvals).toEqual([SUCCESS_EVAL]);
    });

    it('passes videoId, audioPath, and cache to transcriptDetector.detect', async () => {
      const detector = makeTranscriptDetector({
        lines: LINES,
        microBlocks: MICRO_BLOCKS,
        chunks: CHUNKS,
      });
      const cache = makeCache();
      vi.mocked(analyzeChunks).mockResolvedValue([SUCCESS_EVAL]);

      const analyzer = new LLMAnalyzer(detector, cache);
      await analyzer.analyze({
        videoId: 'vid-xyz',
        audioPath: '/tmp/audio.wav',
        audioEvents: [],
        maxParallel: 2,
        noCache: false,
      });

      expect(detector.detect).toHaveBeenCalledWith('vid-xyz', '/tmp/audio.wav', cache);
    });

    it('forwards audioEvents and noCache to analyzeChunks', async () => {
      const audioEvents = [
        { time: 5, event: 'explosion', confidence: 0.9, source: 'gemini' as const },
      ];
      const detector = makeTranscriptDetector({
        lines: LINES,
        microBlocks: MICRO_BLOCKS,
        chunks: CHUNKS,
      });
      vi.mocked(analyzeChunks).mockResolvedValue([SUCCESS_EVAL]);

      const analyzer = new LLMAnalyzer(detector, makeCache());
      await analyzer.analyze({
        videoId: 'abc123',
        audioPath: null,
        audioEvents,
        maxParallel: 1,
        noCache: true,
      });

      expect(analyzeChunks).toHaveBeenCalledWith(
        CHUNKS,
        LINES,
        audioEvents,
        1, // maxParallel
        expect.anything(), // cache
        true, // noCache
      );
    });

    it('limits chunks to maxChunks when provided', async () => {
      const manyChunks: LLMChunk[] = Array.from({ length: 5 }, (_, i) => ({
        text: `chunk ${i}`,
        start: i * 120,
        end: (i + 1) * 120,
      }));
      const detector = makeTranscriptDetector({
        lines: LINES,
        microBlocks: MICRO_BLOCKS,
        chunks: manyChunks,
      });
      vi.mocked(analyzeChunks).mockResolvedValue([SUCCESS_EVAL]);

      const analyzer = new LLMAnalyzer(detector, makeCache());
      await analyzer.analyze({
        videoId: 'abc123',
        audioPath: null,
        audioEvents: [],
        maxChunks: 2,
        maxParallel: 3,
        noCache: true,
      });

      const calledWith = vi.mocked(analyzeChunks).mock.calls[0][0] as LLMChunk[];
      expect(calledWith).toHaveLength(2);
    });

    it('throws when all chunks fail (zero succeeded)', async () => {
      const failedEval: ChunkEvaluation = {
        status: 'failed',
        chunk_index: 0,
        chunk_start: 0,
        chunk_end: 120,
        error: 'LLM error',
      };
      const detector = makeTranscriptDetector({
        lines: LINES,
        microBlocks: MICRO_BLOCKS,
        chunks: CHUNKS,
      });
      vi.mocked(analyzeChunks).mockResolvedValue([failedEval]);

      const analyzer = new LLMAnalyzer(detector, makeCache());

      await expect(
        analyzer.analyze({
          videoId: 'abc123',
          audioPath: null,
          audioEvents: [],
          maxParallel: 1,
          noCache: true,
        }),
      ).rejects.toThrow('All chunks failed LLM analysis');
    });

    it('propagates errors thrown by transcriptDetector.detect', async () => {
      const detector = makeTranscriptDetector(new Error('no transcript available'));

      const analyzer = new LLMAnalyzer(detector, makeCache());

      await expect(
        analyzer.analyze({
          videoId: 'abc123',
          audioPath: null,
          audioEvents: [],
          maxParallel: 1,
          noCache: true,
        }),
      ).rejects.toThrow('no transcript available');
    });
  });

  // ── refine() ──────────────────────────────────────────────────────────────

  describe('refine()', () => {
    it('delegates to refineSegments and returns its result', async () => {
      const refined: RankedSegment = { ...RANKED_SEGMENT, start: 12, end: 58 };
      vi.mocked(refineSegments).mockResolvedValue([refined]);

      const analyzer = new LLMAnalyzer(
        makeTranscriptDetector({ lines: LINES, microBlocks: MICRO_BLOCKS, chunks: CHUNKS }),
        makeCache(),
      );
      const result = await analyzer.refine([RANKED_SEGMENT], MICRO_BLOCKS, {
        maxParallel: 2,
        noCache: false,
      });

      expect(result).toEqual([refined]);
    });

    it('passes segments, microBlocks, maxParallel and noCache to refineSegments', async () => {
      vi.mocked(refineSegments).mockResolvedValue([RANKED_SEGMENT]);

      const analyzer = new LLMAnalyzer(
        makeTranscriptDetector({ lines: LINES, microBlocks: MICRO_BLOCKS, chunks: CHUNKS }),
        makeCache(),
      );
      await analyzer.refine([RANKED_SEGMENT], MICRO_BLOCKS, { maxParallel: 4, noCache: true });

      expect(refineSegments).toHaveBeenCalledWith(
        [RANKED_SEGMENT],
        MICRO_BLOCKS,
        4,
        expect.anything(),
        true,
      );
    });

    it('returns an empty array when passed no segments', async () => {
      vi.mocked(refineSegments).mockResolvedValue([]);

      const analyzer = new LLMAnalyzer(
        makeTranscriptDetector({ lines: LINES, microBlocks: MICRO_BLOCKS, chunks: CHUNKS }),
        makeCache(),
      );
      const result = await analyzer.refine([], MICRO_BLOCKS, { maxParallel: 1, noCache: true });

      expect(result).toEqual([]);
    });
  });
});
