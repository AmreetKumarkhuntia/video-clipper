import { describe, expect, it } from 'vitest';
import { excerptForSegment, toClipCandidate } from '@lib/utils/transcriptUtils.js';
import type { RankedSegment, TranscriptLine } from '@lib/types/index.js';

const segment: RankedSegment = {
  rank: 2,
  start: 10,
  end: 20,
  score: 8,
  reason: 'Strong moment',
  source: 'both',
  audio_event: 'cheer',
};

describe('transcriptUtils', () => {
  it('builds a selected clip candidate with nearby transcript context', () => {
    const lines: TranscriptLine[] = [
      { start: 6, duration: 1, text: 'too early' },
      { start: 7, duration: 1, text: 'lead in' },
      { start: 15, duration: 1, text: 'main moment' },
      { start: 23, duration: 1, text: 'follow up' },
      { start: 24, duration: 1, text: 'too late' },
    ];

    expect(toClipCandidate('video-1', segment, lines)).toEqual({
      id: 'video-1-rank-2',
      rank: 2,
      startSec: 10,
      endSec: 20,
      score: 8,
      reason: 'Strong moment',
      source: 'both',
      audioEvent: 'cheer',
      transcriptExcerpt: 'lead in main moment follow up',
      selected: true,
    });
  });

  it('caps excerpts at 500 characters with an ellipsis', () => {
    const excerpt = excerptForSegment([{ start: 1, duration: 1, text: 'x'.repeat(600) }], 1, 2);

    expect(excerpt).toHaveLength(500);
    expect(excerpt.endsWith('...')).toBe(true);
  });
});
