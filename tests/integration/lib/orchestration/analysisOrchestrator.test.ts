import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigSchema } from '@lib/types/config.js';
import type { AnalyzeChunksOpts } from '@lib/types/analyzer.js';
import type { CreateAnalysisRequest } from '@lib/types/analysis.js';
import type { ChunkEvaluation, RankedSegment, StreamCallbacks } from '@lib/types/index.js';

const mocks = vi.hoisted(() => ({
  analyzeChunks: vi.fn(),
  clearSegmentations: vi.fn(),
  findChunks: vi.fn(),
  findSegmentations: vi.fn(),
  insertSegmentation: vi.fn(),
  loadOrFetchTranscript: vi.fn(),
  markSegmentationsComplete: vi.fn(),
  refineRankedSegments: vi.fn(),
  saveAnalysisToDb: vi.fn(),
  selectSegments: vi.fn(),
  setChunkAnalysisByRange: vi.fn(),
  upsertSegmentations: vi.fn(),
}));

vi.mock('@lib/services/modelFactory/index.js', () => ({
  Model: class MockModel {
    constructor(_config: unknown) {}
  },
}));

vi.mock('@lib/services/analysis/index.js', () => ({
  analyzeChunks: mocks.analyzeChunks,
  DEFAULT_ANALYSIS_TOOL_SYSTEM_PROMPT: 'test analysis prompt',
}));

vi.mock('@lib/pipeline/stages/segmentAnalyzer.js', () => ({
  refineRankedSegments: mocks.refineRankedSegments,
}));

vi.mock('@lib/pipeline/stages/segmentSelector.js', () => ({
  selectSegments: mocks.selectSegments,
}));

vi.mock('@lib/orchestration/transcriptOrchestrator.js', () => ({
  loadOrFetchTranscript: mocks.loadOrFetchTranscript,
}));

vi.mock('@lib/services/db/index.js', () => ({
  clearSegmentations: mocks.clearSegmentations,
  findChunks: mocks.findChunks,
  findSegmentations: mocks.findSegmentations,
  insertSegmentation: mocks.insertSegmentation,
  markSegmentationsComplete: mocks.markSegmentationsComplete,
  saveAnalysisToDb: mocks.saveAnalysisToDb,
  setChunkAnalysisByRange: mocks.setChunkAnalysisByRange,
  upsertSegmentations: mocks.upsertSegmentations,
}));

import { runAnalysis } from '@lib/orchestration/analysisOrchestrator.js';

const config = ConfigSchema.parse({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key' });
const bundle = {
  videoId: 'video-1',
  lines: [
    { start: 0, duration: 5, text: 'opening' },
    { start: 60, duration: 5, text: 'payoff' },
  ],
  microBlocks: [
    { start: 0, end: 15, text: 'opening' },
    { start: 60, end: 75, text: 'payoff' },
  ],
  chunks: [
    { start: 0, end: 60, text: 'opening' },
    { start: 60, end: 120, text: 'payoff' },
  ],
  fetchedAt: '2026-01-01T00:00:00.000Z',
};

const cachedEvaluation: ChunkEvaluation = {
  status: 'success',
  chunk_index: 99,
  chunk_start: 0,
  chunk_end: 60,
  interesting: true,
  score: 8,
  reason: 'cached moment',
  clip_start: 10,
  clip_end: 20,
};

const freshEvaluation: ChunkEvaluation = {
  status: 'success',
  chunk_index: 0,
  chunk_start: 60,
  chunk_end: 120,
  interesting: true,
  score: 9,
  reason: 'fresh moment',
  clip_start: 70,
  clip_end: 80,
};

const rankedSegment: RankedSegment = {
  rank: 1,
  start: 70,
  end: 80,
  score: 9,
  reason: 'fresh moment',
  source: 'transcript',
};

const fallbackSegment: RankedSegment = {
  rank: 2,
  start: 30,
  end: 40,
  score: 8,
  reason: 'fallback moment',
  source: 'transcript',
};

function request(refine = false): CreateAnalysisRequest {
  return {
    videoId: 'video-1',
    title: 'Test video',
    durationSec: 120,
    options: { noCache: false, noSegmentCache: false, refine },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadOrFetchTranscript.mockResolvedValue(bundle);
  mocks.findChunks.mockReturnValue([]);
  mocks.findSegmentations.mockReturnValue([]);
  mocks.selectSegments.mockReturnValue([rankedSegment]);
  mocks.refineRankedSegments.mockResolvedValue([rankedSegment]);
});

describe('runAnalysis cache orchestration', () => {
  it('combines cached and fresh evaluations using global chunk indices', async () => {
    mocks.findChunks.mockReturnValue([
      { start: 0, end: 60, analysis: JSON.stringify(cachedEvaluation) },
      { start: 60, end: 120, analysis: null },
    ]);
    mocks.analyzeChunks.mockImplementation(async (...args: unknown[]) => {
      const options = args[4] as AnalyzeChunksOpts;
      options.callbacks?.onChunkStarted?.(0);
      options.callbacks?.onChunkAnalyzed?.(0, freshEvaluation);
      return [freshEvaluation];
    });
    const onChunkStarted = vi.fn<NonNullable<StreamCallbacks['onChunkStarted']>>();
    const onChunkAnalyzed = vi.fn<NonNullable<StreamCallbacks['onChunkAnalyzed']>>();

    const result = await runAnalysis(request(), config, { onChunkStarted, onChunkAnalyzed });

    expect(result.chunkEvaluations.map((evaluation) => evaluation.chunk_index)).toEqual([0, 1]);
    expect(onChunkStarted.mock.calls.map(([index]) => index)).toEqual([0, 1]);
    expect(onChunkAnalyzed.mock.calls.map(([index]) => index)).toEqual([0, 1]);
    expect(mocks.setChunkAnalysisByRange).toHaveBeenCalledWith(
      'video-1',
      60,
      120,
      expect.any(String),
      9,
    );
    expect(mocks.clearSegmentations).toHaveBeenCalledWith('video-1');
    expect(mocks.upsertSegmentations).toHaveBeenCalledWith(
      'video-1',
      [rankedSegment],
      expect.any(String),
    );
    expect(mocks.saveAnalysisToDb).toHaveBeenCalledWith(result, expect.any(String));
  });

  it('uses a completed segmentation cache when every chunk evaluation is cached', async () => {
    mocks.findChunks.mockReturnValue([
      { start: 0, end: 60, analysis: JSON.stringify(cachedEvaluation) },
    ]);
    mocks.loadOrFetchTranscript.mockResolvedValue({
      ...bundle,
      chunks: bundle.chunks.slice(0, 1),
    });
    mocks.findSegmentations.mockReturnValue([rankedSegment]);

    const result = await runAnalysis(request(), config);

    expect(result.candidates).toHaveLength(1);
    expect(mocks.analyzeChunks).not.toHaveBeenCalled();
    expect(mocks.selectSegments).not.toHaveBeenCalled();
    expect(mocks.upsertSegmentations).not.toHaveBeenCalled();
  });

  it('re-analyzes malformed cached evaluations and fails clearly when none succeed', async () => {
    const failed: ChunkEvaluation = {
      status: 'failed',
      chunk_index: 0,
      chunk_start: 0,
      chunk_end: 60,
      error: 'model unavailable',
    };
    mocks.loadOrFetchTranscript.mockResolvedValue({
      ...bundle,
      chunks: bundle.chunks.slice(0, 1),
    });
    mocks.findChunks.mockReturnValue([{ start: 0, end: 60, analysis: '{broken' }]);
    mocks.analyzeChunks.mockResolvedValue([failed]);

    await expect(runAnalysis(request(), config)).rejects.toThrow('All chunks failed LLM analysis');
    expect(mocks.analyzeChunks).toHaveBeenCalledOnce();
    expect(mocks.clearSegmentations).toHaveBeenCalledWith('video-1');
    expect(mocks.saveAnalysisToDb).not.toHaveBeenCalled();
  });

  it('persists refined segments incrementally before marking the batch complete', async () => {
    mocks.findChunks.mockReturnValue([
      { start: 0, end: 60, analysis: JSON.stringify(cachedEvaluation) },
    ]);
    mocks.loadOrFetchTranscript.mockResolvedValue({
      ...bundle,
      chunks: bundle.chunks.slice(0, 1),
    });
    mocks.refineRankedSegments.mockImplementation(async (...args: unknown[]) => {
      const options = args[2] as { callbacks?: StreamCallbacks };
      options.callbacks?.onSegmentRefined?.(rankedSegment.rank, rankedSegment);
      return [rankedSegment];
    });

    await runAnalysis(request(true), config);

    expect(mocks.clearSegmentations).toHaveBeenCalledWith('video-1');
    expect(mocks.insertSegmentation).toHaveBeenCalledWith(
      'video-1',
      rankedSegment,
      expect.any(String),
    );
    expect(mocks.markSegmentationsComplete).toHaveBeenCalledWith('video-1');
    expect(mocks.insertSegmentation.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.markSegmentationsComplete.mock.invocationCallOrder[0],
    );
  });

  it('persists original segments returned after an individual refinement failure', async () => {
    mocks.findChunks.mockReturnValue([
      { start: 0, end: 60, analysis: JSON.stringify(cachedEvaluation) },
    ]);
    mocks.loadOrFetchTranscript.mockResolvedValue({
      ...bundle,
      chunks: bundle.chunks.slice(0, 1),
    });
    mocks.selectSegments.mockReturnValue([rankedSegment, fallbackSegment]);
    mocks.refineRankedSegments.mockImplementation(async (...args: unknown[]) => {
      const options = args[2] as { callbacks?: StreamCallbacks };
      options.callbacks?.onSegmentRefined?.(rankedSegment.rank, rankedSegment);
      return [rankedSegment, fallbackSegment];
    });

    await runAnalysis(request(true), config);

    expect(mocks.insertSegmentation.mock.calls).toEqual([
      ['video-1', rankedSegment, expect.any(String)],
      ['video-1', fallbackSegment, expect.any(String)],
    ]);
    expect(mocks.insertSegmentation.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.markSegmentationsComplete.mock.invocationCallOrder[0],
    );
  });
});
