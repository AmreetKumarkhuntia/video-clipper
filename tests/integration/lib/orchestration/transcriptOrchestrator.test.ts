import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigSchema } from '@lib/types/config.js';

const mocks = vi.hoisted(() => ({
  buildLLMChunks: vi.fn(),
  buildMicroBlocks: vi.fn(),
  clearTranscript: vi.fn(),
  createTranscriptChain: vi.fn(),
  deleteChunks: vi.fn(),
  detect: vi.fn(),
  findTranscriptLines: vi.fn(),
  saveTranscript: vi.fn(),
  upsertChunks: vi.fn(),
}));

vi.mock('@lib/services/analysis/index.js', () => ({
  TranscriptDetector: class MockTranscriptDetector {
    async detect(videoId: string, audioPath: string | null): Promise<unknown> {
      return mocks.detect(videoId, audioPath);
    }
  },
  buildLLMChunks: mocks.buildLLMChunks,
  buildMicroBlocks: mocks.buildMicroBlocks,
}));

vi.mock('@lib/services/audio/index.js', () => ({
  createTranscriptChain: mocks.createTranscriptChain,
}));

vi.mock('@lib/services/db/index.js', () => ({
  clearTranscript: mocks.clearTranscript,
  deleteChunks: mocks.deleteChunks,
  findTranscriptLines: mocks.findTranscriptLines,
  saveTranscript: mocks.saveTranscript,
  upsertChunks: mocks.upsertChunks,
}));

import {
  clearVideoTranscript,
  loadOrFetchTranscript,
} from '@lib/orchestration/transcriptOrchestrator.js';

const config = ConfigSchema.parse({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key' });
const lines = [
  { start: 0, duration: 5, text: 'opening' },
  { start: 20, duration: 5, text: 'payoff' },
];
const microBlocks = [
  { start: 0, end: 15, text: 'opening' },
  { start: 20, end: 35, text: 'payoff' },
];
const chunks = [{ start: 0, end: 35, text: 'opening payoff' }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.buildMicroBlocks.mockReturnValue(microBlocks);
  mocks.buildLLMChunks.mockReturnValue(chunks);
  mocks.createTranscriptChain.mockReturnValue([{ source: 'test' }]);
  mocks.detect.mockResolvedValue({ lines, microBlocks, chunks });
});

describe('loadOrFetchTranscript', () => {
  it('rebuilds derived blocks from the stored transcript without calling a provider', async () => {
    mocks.findTranscriptLines.mockReturnValue({
      lines,
      fetchedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await loadOrFetchTranscript('video-1', config);

    expect(result).toEqual({
      videoId: 'video-1',
      lines,
      microBlocks,
      chunks,
      fetchedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(mocks.createTranscriptChain).not.toHaveBeenCalled();
    expect(mocks.detect).not.toHaveBeenCalled();
    expect(mocks.saveTranscript).not.toHaveBeenCalled();
  });

  it('forces a provider fetch for an explicit language and persists the replacement', async () => {
    mocks.findTranscriptLines.mockReturnValue({
      lines: [{ start: 0, duration: 1, text: 'stale' }],
      fetchedAt: '2025-01-01T00:00:00.000Z',
    });

    const result = await loadOrFetchTranscript('video-1', config, 'hi');

    expect(mocks.findTranscriptLines).not.toHaveBeenCalled();
    expect(mocks.createTranscriptChain).toHaveBeenCalledWith(
      config.TRANSCRIPT_PROVIDER,
      expect.objectContaining({ languageCode: 'hi' }),
    );
    expect(mocks.detect).toHaveBeenCalledWith('video-1', null);
    expect(mocks.saveTranscript).toHaveBeenCalledWith('video-1', lines, result.fetchedAt);
    expect(mocks.upsertChunks).toHaveBeenCalledWith('video-1', [
      expect.objectContaining({
        videoId: 'video-1',
        chunk: JSON.stringify(chunks[0]),
        start: 0,
        end: 35,
      }),
    ]);
  });
});

describe('clearVideoTranscript', () => {
  it('clears both the transcript and its derived chunks', () => {
    mocks.clearTranscript.mockReturnValue(true);

    expect(clearVideoTranscript('video-1')).toEqual({ dbCleared: true });
    expect(mocks.clearTranscript).toHaveBeenCalledWith('video-1');
    expect(mocks.deleteChunks).toHaveBeenCalledWith('video-1');
  });
});
