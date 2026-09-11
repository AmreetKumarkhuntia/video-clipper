import { describe, expect, it, vi } from 'vitest';
import { analyzeChunks } from '@lib/services/analysis/llm/index.js';
import { createFakeStreamingModel } from '../../../../../support/fakeStreamingModel.js';

describe('analyzeChunks', () => {
  it('returns a failed evaluation without aborting the remaining chunks', async () => {
    const { model, streamText } = createFakeStreamingModel([
      { error: new Error('provider unavailable') },
      {
        textDeltas: ['working', ' done'],
        input: {
          interesting: true,
          score: 8,
          reason: 'Concise explanation with a strong payoff',
          clip_start: 60,
          clip_end: 80,
        },
      },
    ]);
    const onChunkStarted = vi.fn();
    const onChunkTextDelta = vi.fn();
    const onChunkAnalyzed = vi.fn();

    const result = await analyzeChunks(
      [
        { start: 0, end: 20, text: 'first chunk' },
        { start: 60, end: 80, text: 'second chunk' },
      ],
      [],
      [],
      1,
      {
        maxRetries: 0,
        systemPrompt: 'Find useful moments.',
        model,
        callbacks: { onChunkStarted, onChunkTextDelta, onChunkAnalyzed },
      },
    );

    expect(result).toEqual([
      {
        status: 'failed',
        chunk_index: 0,
        chunk_start: 0,
        chunk_end: 20,
        error: 'provider unavailable',
      },
      {
        status: 'success',
        chunk_index: 1,
        chunk_start: 60,
        chunk_end: 80,
        interesting: true,
        score: 8,
        reason: 'Concise explanation with a strong payoff',
        clip_start: 60,
        clip_end: 80,
      },
    ]);
    expect(streamText).toHaveBeenCalledTimes(2);
    expect(onChunkStarted.mock.calls).toEqual([[0], [1]]);
    expect(onChunkTextDelta.mock.calls).toEqual([
      [1, 'working'],
      [1, ' done'],
    ]);
    expect(onChunkAnalyzed).toHaveBeenCalledTimes(2);
  });
});
