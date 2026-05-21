import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMAnalyzer } from '../src/lib/services/analysis/llm/LLMAnalyzer.js';
import type { TranscriptDetector } from '../src/lib/services/analysis/transcript/detector.js';
import type {
  TranscriptLine,
  MicroBlock,
  LLMChunk,
  ChunkEvaluation,
  RankedSegment,
} from '../src/lib/types/index.js';
import type { Model } from '../src/lib/services/modelFactory/index.js';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that touch these modules
// ---------------------------------------------------------------------------

vi.mock('../src/lib/services/analysis/llm/index.js', () => ({
  analyzeChunks: vi.fn(),
}));

vi.mock('../src/lib/services/analysis/refiner/index.js', () => ({
  refineSegments: vi.fn(),
}));

// Import the mocked free functions so we can configure them per test
import { analyzeChunks } from '../src/lib/services/analysis/llm/index.js';
import { refineSegments } from '../src/lib/services/analysis/refiner/index.js';

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

function makeModel(): Model {
  return {} as unknown as Model;
}

function makeAnalyzer(detector: TranscriptDetector): LLMAnalyzer {
  return new LLMAnalyzer(detector, makeModel(), undefined, 3, 'default prompt', 'test-model');
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

      const analyzer = makeAnalyzer(detector);
      const result = await analyzer.analyze({
        videoId: 'abc123',
        audioPath: null,
        audioEvents: [],
        maxParallel: 3,
      });

      expect(result.lines).toEqual(LINES);
      expect(result.microBlocks).toEqual(MICRO_BLOCKS);
      expect(result.chunks).toEqual(CHUNKS);
      expect(result.chunkEvals).toEqual([SUCCESS_EVAL]);
    });

    it('passes videoId and audioPath to transcriptDetector.detect', async () => {
      const detector = makeTranscriptDetector({
        lines: LINES,
        microBlocks: MICRO_BLOCKS,
        chunks: CHUNKS,
      });
      vi.mocked(analyzeChunks).mockResolvedValue([SUCCESS_EVAL]);

      const analyzer = makeAnalyzer(detector);
      await analyzer.analyze({
        videoId: 'vid-xyz',
        audioPath: '/tmp/audio.wav',
        audioEvents: [],
        maxParallel: 2,
      });

      expect(detector.detect).toHaveBeenCalledWith('vid-xyz', '/tmp/audio.wav');
    });

    it('forwards audioEvents to analyzeChunks', async () => {
      const audioEvents = [
        { time: 5, event: 'explosion', confidence: 0.9, source: 'gemini' as const },
      ];
      const detector = makeTranscriptDetector({
        lines: LINES,
        microBlocks: MICRO_BLOCKS,
        chunks: CHUNKS,
      });
      vi.mocked(analyzeChunks).mockResolvedValue([SUCCESS_EVAL]);

      const analyzer = makeAnalyzer(detector);
      await analyzer.analyze({
        videoId: 'abc123',
        audioPath: null,
        audioEvents,
        maxParallel: 1,
      });

      expect(analyzeChunks).toHaveBeenCalledWith(
        CHUNKS,
        LINES,
        audioEvents,
        1,
        expect.objectContaining({
          maxRetries: 3,
          systemPrompt: 'default prompt',
        }),
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

      const analyzer = makeAnalyzer(detector);
      await analyzer.analyze({
        videoId: 'abc123',
        audioPath: null,
        audioEvents: [],
        maxChunks: 2,
        maxParallel: 3,
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

      const analyzer = makeAnalyzer(detector);

      await expect(
        analyzer.analyze({
          videoId: 'abc123',
          audioPath: null,
          audioEvents: [],
          maxParallel: 1,
        }),
      ).rejects.toThrow('All chunks failed LLM analysis');
    });

    it('propagates errors thrown by transcriptDetector.detect', async () => {
      const detector = makeTranscriptDetector(new Error('no transcript available'));

      const analyzer = makeAnalyzer(detector);

      await expect(
        analyzer.analyze({
          videoId: 'abc123',
          audioPath: null,
          audioEvents: [],
          maxParallel: 1,
        }),
      ).rejects.toThrow('no transcript available');
    });
  });

  // ── refine() ──────────────────────────────────────────────────────────────

  describe('refine()', () => {
    it('delegates to refineSegments and returns its result', async () => {
      const refined: RankedSegment = { ...RANKED_SEGMENT, start: 12, end: 58 };
      vi.mocked(refineSegments).mockResolvedValue([refined]);

      const analyzer = makeAnalyzer(
        makeTranscriptDetector({ lines: LINES, microBlocks: MICRO_BLOCKS, chunks: CHUNKS }),
      );
      const result = await analyzer.refine([RANKED_SEGMENT], MICRO_BLOCKS, {
        maxParallel: 2,
      });

      expect(result).toEqual([refined]);
    });

    it('passes segments, microBlocks, and maxParallel to refineSegments', async () => {
      vi.mocked(refineSegments).mockResolvedValue([RANKED_SEGMENT]);

      const analyzer = makeAnalyzer(
        makeTranscriptDetector({ lines: LINES, microBlocks: MICRO_BLOCKS, chunks: CHUNKS }),
      );
      await analyzer.refine([RANKED_SEGMENT], MICRO_BLOCKS, { maxParallel: 4 });

      expect(refineSegments).toHaveBeenCalledWith(
        [RANKED_SEGMENT],
        MICRO_BLOCKS,
        4,
        expect.objectContaining({
          maxRetries: 3,
        }),
      );
    });

    it('returns an empty array when passed no segments', async () => {
      vi.mocked(refineSegments).mockResolvedValue([]);

      const analyzer = makeAnalyzer(
        makeTranscriptDetector({ lines: LINES, microBlocks: MICRO_BLOCKS, chunks: CHUNKS }),
      );
      const result = await analyzer.refine([], MICRO_BLOCKS, { maxParallel: 1 });

      expect(result).toEqual([]);
    });
  });
});
