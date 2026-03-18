import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranscriptDetector } from '../src/services/transcriptDetector/index.js';
import type { TranscriptAnalyzer } from '../src/services/transcriptAnalyzers/index.js';
import type { TranscriptLine } from '../src/types/index.js';
import type { Cache } from '../src/utils/cache.js';

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

function makeCache(cachedLines: TranscriptLine[] | null = null): Cache {
  return {
    readTranscript: vi.fn().mockResolvedValue(cachedLines),
    writeTranscript: vi.fn().mockResolvedValue(undefined),
  } as unknown as Cache;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TranscriptDetector', () => {
  describe('constructor', () => {
    it('throws when chain is empty', () => {
      expect(() => new TranscriptDetector([])).toThrow(
        'TranscriptDetector requires at least one TranscriptAnalyzer',
      );
    });
  });

  describe('detect — cache-first behaviour', () => {
    it('returns cached lines without calling any analyzer', async () => {
      const cached = [LINE_A, LINE_B];
      const analyzer = makeAnalyzer('ytdlp', []);
      const cache = makeCache(cached);
      const detector = new TranscriptDetector([analyzer]);

      const result = await detector.detect('abc123', null, cache);

      expect(result.lines).toEqual(cached);
      expect(analyzer.detect).not.toHaveBeenCalled();
      expect(cache.writeTranscript).not.toHaveBeenCalled();
    });
  });

  describe('detect — provider chain', () => {
    let cache: Cache;

    beforeEach(() => {
      cache = makeCache(null); // no cache → always hits the chain
    });

    it('returns lines from the first analyzer on success', async () => {
      const analyzer = makeAnalyzer('ytdlp', [LINE_A]);
      const detector = new TranscriptDetector([analyzer]);

      const result = await detector.detect('abc123', null, cache);

      expect(result.lines).toEqual([LINE_A]);
      expect(cache.writeTranscript).toHaveBeenCalledWith('abc123', [LINE_A]);
    });

    it('falls back to second analyzer when first throws', async () => {
      const first = makeAnalyzer('ytdlp', new Error('no subtitles'));
      const second = makeAnalyzer('whisper', [LINE_B]);
      const detector = new TranscriptDetector([first, second]);

      const result = await detector.detect('abc123', null, cache);

      expect(result.lines).toEqual([LINE_B]);
      expect(cache.writeTranscript).toHaveBeenCalledWith('abc123', [LINE_B]);
    });

    it('re-throws the last error when the whole chain is exhausted', async () => {
      const err1 = new Error('ytdlp failed');
      const err2 = new Error('whisper crashed');
      const first = makeAnalyzer('ytdlp', err1);
      const second = makeAnalyzer('whisper', err2);
      const detector = new TranscriptDetector([first, second]);

      await expect(detector.detect('abc123', null, cache)).rejects.toThrow('whisper crashed');
    });

    it('does not call the second analyzer when the first succeeds', async () => {
      const first = makeAnalyzer('ytdlp', [LINE_A]);
      const second = makeAnalyzer('whisper', [LINE_B]);
      const detector = new TranscriptDetector([first, second]);

      await detector.detect('abc123', null, cache);
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
      const cache = makeCache(null);
      const detector = new TranscriptDetector([analyzer]);

      const result = await detector.detect('abc123', null, cache);

      expect(result.lines).toHaveLength(20);
      expect(result.microBlocks.length).toBeGreaterThan(0);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('returns empty microBlocks and chunks for an empty transcript', async () => {
      const analyzer = makeAnalyzer('ytdlp', []);
      const cache = makeCache(null);
      const detector = new TranscriptDetector([analyzer]);

      const result = await detector.detect('abc123', null, cache);

      expect(result.lines).toHaveLength(0);
      expect(result.microBlocks).toHaveLength(0);
      expect(result.chunks).toHaveLength(0);
    });
  });

  describe('detect — audioPath forwarding', () => {
    it('passes audioPath through to the analyzer', async () => {
      const analyzer = makeAnalyzer('whisper', [LINE_A]);
      const cache = makeCache(null);
      const detector = new TranscriptDetector([analyzer]);

      await detector.detect('abc123', '/tmp/audio.wav', cache);
      expect(analyzer.detect).toHaveBeenCalledWith('abc123', '/tmp/audio.wav');
    });
  });
});
