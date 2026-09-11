import { describe, expect, it } from 'vitest';
import { selectSegments } from '@lib/pipeline/stages/segmentSelector.js';
import type { AudioEvent, ChunkEvaluation, SegmentSelectorOpts } from '@lib/types/index.js';

const options: SegmentSelectorOpts = {
  threshold: 7,
  topN: 3,
  boostWindow: 10,
  scoreBoost: 2,
  preRoll: 5,
  postRoll: 10,
};

describe('selectSegments', () => {
  it('merges audio evidence, applies the threshold, and assigns final ranks', () => {
    const chunks: ChunkEvaluation[] = [
      {
        status: 'success',
        chunk_index: 0,
        chunk_start: 0,
        chunk_end: 60,
        interesting: true,
        score: 6,
        reason: 'Interesting after audio confirmation',
        clip_start: 10,
        clip_end: 20,
      },
      {
        status: 'success',
        chunk_index: 1,
        chunk_start: 60,
        chunk_end: 120,
        interesting: true,
        score: 5,
        reason: 'Below threshold',
        clip_start: 70,
        clip_end: 80,
      },
    ];
    const audio: AudioEvent[] = [{ time: 15, event: 'cheer', confidence: 0.9, source: 'gemini' }];

    expect(selectSegments(chunks, audio, options)).toMatchObject([
      {
        rank: 1,
        start: 10,
        end: 20,
        score: 8,
        source: 'both',
        audio_event: 'cheer',
      },
    ]);
  });

  it('returns no segments when every signal is below the threshold', () => {
    const chunks: ChunkEvaluation[] = [
      {
        status: 'success',
        chunk_index: 0,
        chunk_start: 0,
        chunk_end: 60,
        interesting: true,
        score: 4,
        reason: 'Weak moment',
        clip_start: 10,
        clip_end: 20,
      },
    ];

    expect(selectSegments(chunks, [], options)).toEqual([]);
  });
});
