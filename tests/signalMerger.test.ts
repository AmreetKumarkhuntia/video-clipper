import { describe, it, expect } from 'vitest';
import { mergeSignals } from '../src/services/signalMerger/index.js';
import type { ChunkEvaluation, AudioEvent } from '../src/types/index.js';

function createSuccessEvaluation(
  clipStart: number,
  clipEnd: number,
  score: number,
  interesting = true,
): ChunkEvaluation {
  return {
    status: 'success',
    chunk_index: 0,
    chunk_start: 0,
    chunk_end: 100,
    interesting,
    score,
    reason: 'Test reason',
    clip_start: clipStart,
    clip_end: clipEnd,
  };
}

function createFailedEvaluation(): ChunkEvaluation {
  return {
    status: 'failed',
    chunk_index: 0,
    chunk_start: 0,
    chunk_end: 100,
    error: 'Test error',
  };
}

function createAudioEvent(time: number, confidence = 0.8, event = 'gunshot'): AudioEvent {
  return {
    time,
    event,
    confidence,
    source: 'gemini',
  };
}

describe('mergeSignals', () => {
  it('returns empty array when both inputs are empty', () => {
    const result = mergeSignals([], [], 10, 2, 5, 15);
    expect(result).toEqual([]);
  });

  it('processes LLM-only segments with no audio events', () => {
    const llmSegments = [createSuccessEvaluation(10, 20, 7)];
    const audioEvents: AudioEvent[] = [];

    const result = mergeSignals(llmSegments, audioEvents, 10, 2, 5, 15);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      start: 10,
      end: 20,
      score: 7,
      source: 'transcript',
      reason: 'Test reason',
      audio_event: undefined,
    });
  });

  it('processes audio-only events with no nearby LLM segments', () => {
    const llmSegments: ChunkEvaluation[] = [];
    const audioEvents = [createAudioEvent(30, 0.9, 'explosion')];

    const result = mergeSignals(llmSegments, audioEvents, 10, 2, 5, 15);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      start: 25,
      end: 45,
      score: 9,
      source: 'audio',
      reason: 'Audio event: explosion (90% confidence)',
      audio_event: 'explosion',
    });
  });

  it('boosts LLM segment score when nearby audio event exists', () => {
    const llmSegments = [createSuccessEvaluation(10, 20, 6)];
    const audioEvents = [createAudioEvent(15, 0.8, 'gunshot')];

    const result = mergeSignals(llmSegments, audioEvents, 10, 2, 5, 15);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      start: 10,
      end: 20,
      score: 8,
      source: 'both',
      reason: 'Test reason',
      audio_event: 'gunshot',
    });
  });

  it('caps boosted score at 10', () => {
    const llmSegments = [createSuccessEvaluation(10, 20, 9)];
    const audioEvents = [createAudioEvent(15, 0.8, 'gunshot')];

    const result = mergeSignals(llmSegments, audioEvents, 10, 2, 5, 15);

    expect(result[0].score).toBe(10);
  });

  it('ignores audio event when LLM segment is outside boost window', () => {
    const llmSegments = [createSuccessEvaluation(10, 20, 7)];
    const audioEvents = [createAudioEvent(50, 0.8, 'gunshot')];

    const result = mergeSignals(llmSegments, audioEvents, 10, 2, 5, 15);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      source: 'transcript',
      score: 7,
    });
    expect(result[1]).toMatchObject({
      source: 'audio',
      start: 45,
      end: 65,
    });
  });

  it('ignores LLM segments with interesting=false', () => {
    const llmSegments = [createSuccessEvaluation(10, 20, 7, false)];
    const audioEvents = [createAudioEvent(15, 0.8, 'gunshot')];

    const result = mergeSignals(llmSegments, audioEvents, 10, 2, 5, 15);

    expect(result).toHaveLength(0);
  });

  it('ignores failed LLM segments', () => {
    const llmSegments = [createFailedEvaluation()];
    const audioEvents = [createAudioEvent(15, 0.8, 'gunshot')];

    const result = mergeSignals(llmSegments, audioEvents, 10, 2, 5, 15);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source: 'audio',
    });
  });

  it('handles multiple LLM segments and audio events correctly', () => {
    const llmSegments = [createSuccessEvaluation(10, 20, 6), createSuccessEvaluation(50, 60, 7)];
    const audioEvents = [
      createAudioEvent(15, 0.8, 'gunshot'),
      createAudioEvent(100, 0.9, 'explosion'),
    ];

    const result = mergeSignals(llmSegments, audioEvents, 10, 2, 5, 15);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      source: 'both',
      score: 8,
    });
    expect(result[1]).toMatchObject({
      source: 'transcript',
      score: 7,
    });
    expect(result[2]).toMatchObject({
      source: 'audio',
      start: 95,
      end: 115,
    });
  });

  it('handles audio event at start time with clamp to 0 for negative start', () => {
    const llmSegments: ChunkEvaluation[] = [];
    const audioEvents = [createAudioEvent(3, 0.8, 'gunshot')];

    const result = mergeSignals(llmSegments, audioEvents, 10, 2, 5, 15);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      start: 0,
      end: 18,
    });
  });

  it('uses default config values when overrides not provided', () => {
    const llmSegments = [createSuccessEvaluation(10, 20, 6)];
    const audioEvents = [createAudioEvent(15, 0.8, 'gunshot')];

    const result = mergeSignals(llmSegments, audioEvents);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source: 'both',
    });
  });
});
