import { describe, it, expect, vi } from 'vitest';
import { EventDetector } from '../src/services/eventDetector/index.js';
import type { AudioAnalyzer } from '../src/services/audioAnalyzers/index.js';
import type { AudioEvent } from '../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnalyzer(source: AudioEvent['source'], result: AudioEvent[] | Error): AudioAnalyzer {
  return {
    source,
    detect: vi
      .fn()
      .mockImplementation(() =>
        result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
      ),
  } as unknown as AudioAnalyzer;
}

const EVENT_A: AudioEvent = { time: 10, event: 'gunshot', confidence: 0.9, source: 'gemini' };
const EVENT_B: AudioEvent = { time: 20, event: 'explosion', confidence: 0.8, source: 'whisper' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventDetector', () => {
  describe('constructor', () => {
    it('throws when chain is empty', () => {
      expect(() => new EventDetector([])).toThrow(
        'EventDetector requires at least one AudioAnalyzer',
      );
    });
  });

  describe('detect — single analyzer', () => {
    it('returns events from the sole analyzer on success', async () => {
      const analyzer = makeAnalyzer('gemini', [EVENT_A]);
      const detector = new EventDetector([analyzer]);
      const events = await detector.detect('audio.wav', 'general', 0, 120);
      expect(events).toEqual([EVENT_A]);
      expect(analyzer.detect).toHaveBeenCalledOnce();
    });

    it('re-throws when the sole analyzer fails', async () => {
      const err = new Error('gemini unavailable');
      const analyzer = makeAnalyzer('gemini', err);
      const detector = new EventDetector([analyzer]);
      await expect(detector.detect('audio.wav', 'general', 0, 120)).rejects.toThrow(
        'gemini unavailable',
      );
    });
  });

  describe('detect — fallback chain', () => {
    it('returns first-analyzer result without trying the second', async () => {
      const first = makeAnalyzer('gemini', [EVENT_A]);
      const second = makeAnalyzer('whisper', [EVENT_B]);
      const detector = new EventDetector([first, second]);
      const events = await detector.detect('audio.wav', 'general', 0, 120);
      expect(events).toEqual([EVENT_A]);
      expect(second.detect).not.toHaveBeenCalled();
    });

    it('falls back to second analyzer when first throws', async () => {
      const first = makeAnalyzer('gemini', new Error('timeout'));
      const second = makeAnalyzer('whisper', [EVENT_B]);
      const detector = new EventDetector([first, second]);
      const events = await detector.detect('audio.wav', 'general', 0, 120);
      expect(events).toEqual([EVENT_B]);
    });

    it('re-throws the last error when the entire chain is exhausted', async () => {
      const err1 = new Error('gemini down');
      const err2 = new Error('whisper crashed');
      const first = makeAnalyzer('gemini', err1);
      const second = makeAnalyzer('whisper', err2);
      const detector = new EventDetector([first, second]);
      await expect(detector.detect('audio.wav', 'general', 0, 120)).rejects.toThrow(
        'whisper crashed',
      );
    });

    it('skips failing analyzers and returns results from a later one in a three-item chain', async () => {
      const first = makeAnalyzer('gemini', new Error('fail'));
      const second = makeAnalyzer('whisper', new Error('fail'));
      const third = makeAnalyzer('yamnet', [EVENT_A, EVENT_B]);
      const detector = new EventDetector([first, second, third]);
      const events = await detector.detect('audio.wav', 'fps', 0, 120);
      expect(events).toHaveLength(2);
    });
  });

  describe('detect — argument forwarding', () => {
    it('passes all arguments through to the analyzer', async () => {
      const analyzer = makeAnalyzer('gemini', []);
      const detector = new EventDetector([analyzer]);
      await detector.detect('/tmp/slice.wav', 'valorant', 60, 120);
      expect(analyzer.detect).toHaveBeenCalledWith('/tmp/slice.wav', 'valorant', 60, 120);
    });
  });
});
