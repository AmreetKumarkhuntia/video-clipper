import type { ChunkEvaluation, RankedSegment } from '@lib/types/index.js';
import type { AnalysisActivityItem, ActivityStatus } from '@app/web/types/activity.js';

import type { AnalysisActivityState } from '@app/web/types/activity.js';

export type { AnalysisActivityState };

export function createInitialActivityState(): AnalysisActivityState {
  return {
    items: [],
    nextId: 0,
  };
}

export function createStartedActivityState(): AnalysisActivityState {
  return appendSystemActivity(createInitialActivityState(), {
    title: 'Analysis started',
    status: 'running',
    detail: 'Preparing transcript chunks and waiting for model output.',
  });
}

export function appendSystemActivity(
  state: AnalysisActivityState,
  input: { title: string; status: ActivityStatus; detail?: string },
): AnalysisActivityState {
  return {
    items: [
      ...state.items,
      {
        id: `system-${state.nextId + 1}`,
        kind: 'system',
        title: input.title,
        status: input.status,
        detail: input.detail,
      },
    ],
    nextId: state.nextId + 1,
  };
}

export function upsertChunkStarted(
  state: AnalysisActivityState,
  chunkIndex: number,
): AnalysisActivityState {
  const id = `chunk-${chunkIndex}`;
  const existing = state.items.find((item) => item.id === id);

  if (existing) {
    return state;
  }

  return {
    ...state,
    items: [
      ...state.items,
      {
        id,
        kind: 'chunk',
        chunkIndex,
        title: `Analyzing chunk ${chunkIndex + 1}`,
        status: 'running',
        detail: 'Preparing this transcript window for model analysis.',
      },
    ],
  };
}

export function upsertChunkProgress(
  state: AnalysisActivityState,
  chunkIndex: number,
  text: string,
): AnalysisActivityState {
  const id = `chunk-${chunkIndex}`;
  const existing = state.items.find((item) => item.id === id);

  if (existing) {
    return {
      ...state,
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              rawText: `${item.rawText ?? ''}${text}`,
            }
          : item,
      ),
    };
  }

  return {
    ...state,
    items: [
      ...state.items,
      {
        id,
        kind: 'chunk',
        chunkIndex,
        title: `Analyzing chunk ${chunkIndex + 1}`,
        status: 'running',
        detail: 'Streaming model reasoning for this transcript window.',
        rawText: text,
      },
    ],
  };
}

export function upsertChunkCompletion(
  state: AnalysisActivityState,
  chunkIndex: number,
  evaluation: ChunkEvaluation,
): AnalysisActivityState {
  const id = `chunk-${chunkIndex}`;
  const detail =
    evaluation.status === 'success'
      ? evaluation.interesting
        ? `Interesting moment found · score ${evaluation.score}/10 · ${evaluation.reason}`
        : `Not selected · score ${evaluation.score}/10 · ${evaluation.reason}`
      : `Chunk failed: ${evaluation.error}`;

  const updatedItem: AnalysisActivityItem = {
    id,
    kind: 'chunk',
    chunkIndex,
    title: `Chunk ${chunkIndex + 1} complete`,
    status: evaluation.status === 'success' ? 'done' : 'error',
    detail,
    evaluation,
  };

  const existing = state.items.find((item) => item.id === id);
  if (existing) {
    return {
      ...state,
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updatedItem,
              rawText: item.rawText,
            }
          : item,
      ),
    };
  }

  return {
    ...state,
    items: [...state.items, updatedItem],
  };
}

export function upsertSegmentProgress(
  state: AnalysisActivityState,
  rank: number,
  text: string,
): AnalysisActivityState {
  const id = `segment-${rank}`;
  const existing = state.items.find((item) => item.id === id);

  if (existing) {
    return {
      ...state,
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              rawText: `${item.rawText ?? ''}${text}`,
            }
          : item,
      ),
    };
  }

  return {
    ...state,
    items: [
      ...state.items,
      {
        id,
        kind: 'segment',
        rank,
        title: `Refining candidate ${rank}`,
        status: 'running',
        detail: 'Tightening clip boundaries around the selected moment.',
        rawText: text,
      },
    ],
  };
}

export function upsertSegmentStarted(
  state: AnalysisActivityState,
  rank: number,
): AnalysisActivityState {
  const id = `segment-${rank}`;
  const existing = state.items.find((item) => item.id === id);

  if (existing) {
    return state;
  }

  return {
    ...state,
    items: [
      ...state.items,
      {
        id,
        kind: 'segment',
        rank,
        title: `Refining candidate ${rank}`,
        status: 'running',
        detail: 'Tightening clip boundaries around the selected moment.',
      },
    ],
  };
}

export function upsertSegmentCompletion(
  state: AnalysisActivityState,
  rank: number,
  segment: RankedSegment,
  formatTime: (seconds: number) => string,
): AnalysisActivityState {
  const id = `segment-${rank}`;
  const updatedItem: AnalysisActivityItem = {
    id,
    kind: 'segment',
    rank,
    title: `Candidate ${rank} refined`,
    status: 'done',
    detail: `Updated clip window to ${formatTime(segment.start)}-${formatTime(segment.end)}.`,
    segment,
  };

  const existing = state.items.find((item) => item.id === id);
  if (existing) {
    return {
      ...state,
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updatedItem,
              rawText: item.rawText,
            }
          : item,
      ),
    };
  }

  return {
    ...state,
    items: [...state.items, updatedItem],
  };
}
