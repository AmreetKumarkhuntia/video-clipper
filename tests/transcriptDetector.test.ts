import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranscriptDetector } from '../src/lib/services/analysis/transcript/detector.js';
import type { TranscriptAnalyzer } from '../src/lib/services/audio/transcriber/index.js';
import type { TranscriptLine } from '../src/lib/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LINE_A: TranscriptLine = { text: 'Hello world', start: 0, duration: 2 };
const LINE_B: TranscriptLine = { text: 'Second line', start: 2, duration: 2 };

function makeAnalyzer(source: string, result: TranscriptLine[] | Error): TranscriptAnalyzer {
  return {
    source,
    detect: vi
      .fn()
      .mockImplementation(() =>
        result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
      ),
  } as unknown as TranscriptAnalyzer;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const MICRO_BLOCK_SEC = 15;
const CHUNK_LENGTH_SEC = 120;
const CHUNK_OVERLAP_SEC = 20;

function makeDetector(analyzers: TranscriptAnalyzer[]): TranscriptDetector {
  return new TranscriptDetector(analyzers, MICRO_BLOCK_SEC, CHUNK_LENGTH_SEC, CHUNK_OVERLAP_SEC);
}

describe('TranscriptDetector', () => {
  describe('constructor', () => {
    it('throws when chain is empty', () => {
      expect(() => makeDetector([])).toThrow(
        'TranscriptDetector requires at least one TranscriptAnalyzer',
      );
    });
  });

  describe('detect — provider chain', () => {
    it('returns lines from the first analyzer on success', async () => {
      const analyzer = makeAnalyzer('ytdlp', [LINE_A]);
      const detector = makeDetector([analyzer]);

      const result = await detector.detect('abc123', null);

      expect(result.lines).toEqual([LINE_A]);
    });

    it('falls back to second analyzer when first throws', async () => {
      const first = makeAnalyzer('ytdlp', new Error('no subtitles'));
      const second = makeAnalyzer('whisper', [LINE_B]);
      const detector = makeDetector([first, second]);

      const result = await detector.detect('abc123', null);

      expect(result.lines).toEqual([LINE_B]);
    });

    it('re-throws the last error when the whole chain is exhausted', async () => {
      const err1 = new Error('ytdlp failed');
      const err2 = new Error('whisper crashed');
      const first = makeAnalyzer('ytdlp', err1);
      const second = makeAnalyzer('whisper', err2);
      const detector = makeDetector([first, second]);

      await expect(detector.detect('abc123', null)).rejects.toThrow('whisper crashed');
    });

    it('does not call the second analyzer when the first succeeds', async () => {
      const first = makeAnalyzer('ytdlp', [LINE_A]);
      const second = makeAnalyzer('whisper', [LINE_B]);
      const detector = makeDetector([first, second]);

      await detector.detect('abc123', null);
      expect(second.detect).not.toHaveBeenCalled();
    });
  });

  describe('detect — chunk/micro-block building', () => {
    it('returns non-empty microBlocks and chunks for multi-line transcripts', async () => {
      // Produce enough lines to form at least one micro-block and one chunk
      const lines: TranscriptLine[] = Array.from({ length: 20 }, (_, i) => ({
        text: `line ${i}`,
        start: i * 5,
        duration: 5,
      }));
      const analyzer = makeAnalyzer('ytdlp', lines);
      const detector = makeDetector([analyzer]);

      const result = await detector.detect('abc123', null);

      expect(result.lines).toHaveLength(20);
      expect(result.microBlocks.length).toBeGreaterThan(0);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('returns empty microBlocks and chunks for an empty transcript', async () => {
      const analyzer = makeAnalyzer('ytdlp', []);
      const detector = makeDetector([analyzer]);

      const result = await detector.detect('abc123', null);

      expect(result.lines).toHaveLength(0);
      expect(result.microBlocks).toHaveLength(0);
      expect(result.chunks).toHaveLength(0);
    });
  });

  describe('detect — audioPath forwarding', () => {
    it('passes audioPath through to the analyzer', async () => {
      const analyzer = makeAnalyzer('whisper', [LINE_A]);
      const detector = makeDetector([analyzer]);

      await detector.detect('abc123', '/tmp/audio.wav');
      expect(analyzer.detect).toHaveBeenCalledWith('abc123', '/tmp/audio.wav');
    });
  });
});
