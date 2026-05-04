import { describe, expect, it } from 'vitest';
import type { ChunkEvaluation, RankedSegment } from '../src/lib/types/index.js';
import {
  appendSystemActivity,
  createInitialActivityState,
  createStartedActivityState,
  upsertChunkCompletion,
  upsertChunkProgress,
  upsertChunkStarted,
  upsertSegmentCompletion,
  upsertSegmentProgress,
  upsertSegmentStarted,
} from '../src/app/web/lib/activity/analysisActivity.js';

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

const FAILED_EVAL: ChunkEvaluation = {
  status: 'failed',
  chunk_index: 1,
  chunk_start: 120,
  chunk_end: 240,
  error: 'provider timeout',
};

const SEGMENT: RankedSegment = {
  start: 12,
  end: 58,
  score: 8,
  rank: 1,
  reason: 'great moment',
  source: 'transcript',
};

describe('analysisActivity helpers', () => {
  it('creates an initial started system item', () => {
    const state = createStartedActivityState();

    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({
      kind: 'system',
      title: 'Analysis started',
      status: 'running',
    });
  });

  it('creates a chunk item on started and preserves raw text on completion', () => {
    let state = createInitialActivityState();
    state = upsertChunkStarted(state, 0);
    state = upsertChunkProgress(state, 0, 'Thinking...');
    state = upsertChunkCompletion(state, 0, SUCCESS_EVAL);

    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({
      id: 'chunk-0',
      title: 'Chunk 1 complete',
      status: 'done',
      rawText: 'Thinking...',
    });
  });

  it('records failed chunk completions', () => {
    let state = createInitialActivityState();
    state = upsertChunkStarted(state, 1);
    state = upsertChunkCompletion(state, 1, FAILED_EVAL);

    expect(state.items[0]).toMatchObject({
      id: 'chunk-1',
      title: 'Chunk 2 complete',
      status: 'error',
      detail: 'Chunk failed: provider timeout',
    });
  });

  it('creates segment items from started/progress/completion', () => {
    let state = createInitialActivityState();
    state = upsertSegmentStarted(state, 1);
    state = upsertSegmentProgress(state, 1, 'Tightening boundary...');
    state = upsertSegmentCompletion(state, 1, SEGMENT, (seconds) => `${seconds}s`);

    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({
      id: 'segment-1',
      title: 'Candidate 1 refined',
      status: 'done',
      rawText: 'Tightening boundary...',
      detail: 'Updated clip window to 12s-58s.',
    });
  });

  it('appends additional system messages after work completes', () => {
    const state = appendSystemActivity(createStartedActivityState(), {
      title: 'Clip plan ready',
      status: 'done',
      detail: '2 candidate moments are ready for review.',
    });

    expect(state.items).toHaveLength(2);
    expect(state.items[1]).toMatchObject({
      kind: 'system',
      title: 'Clip plan ready',
      status: 'done',
    });
  });
});
