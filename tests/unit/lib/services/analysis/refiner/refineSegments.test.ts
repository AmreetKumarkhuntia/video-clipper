import { describe, expect, it, vi } from 'vitest';
import { refineSegments } from '@lib/services/analysis/refiner/index.js';
import { createFakeStreamingModel } from '../../../../../support/fakeStreamingModel.js';

describe('refineSegments', () => {
  it('keeps a failed segment and applies successful refinements', async () => {
    const segments = [
      {
        rank: 1,
        start: 10,
        end: 20,
        score: 9,
        reason: 'First moment',
        source: 'transcript' as const,
      },
      {
        rank: 2,
        start: 60,
        end: 80,
        score: 8,
        reason: 'Second moment',
        source: 'transcript' as const,
      },
    ];
    const { model } = createFakeStreamingModel([
      { error: new Error('temporary provider failure') },
      {
        toolName: 'report_refined_boundaries',
        textDeltas: ['refining'],
        input: { clip_start: 62, clip_end: 78 },
      },
    ]);
    const onSegmentStarted = vi.fn();
    const onSegmentTextDelta = vi.fn();
    const onSegmentRefined = vi.fn();

    const result = await refineSegments(
      segments,
      [
        { start: 0, end: 30, text: 'First context' },
        { start: 50, end: 90, text: 'Second context' },
      ],
      1,
      {
        maxRetries: 0,
        model,
        callbacks: { onSegmentStarted, onSegmentTextDelta, onSegmentRefined },
      },
    );

    expect(result).toEqual([segments[0], { ...segments[1], start: 62, end: 78 }]);
    expect(onSegmentStarted.mock.calls).toEqual([[1], [2]]);
    expect(onSegmentTextDelta).toHaveBeenCalledWith(2, 'refining');
    expect(onSegmentRefined).toHaveBeenCalledOnce();
    expect(onSegmentRefined).toHaveBeenCalledWith(2, {
      ...segments[1],
      start: 62,
      end: 78,
    });
  });
});
