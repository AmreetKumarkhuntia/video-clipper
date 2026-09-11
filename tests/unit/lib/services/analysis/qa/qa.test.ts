import { describe, expect, it } from 'vitest';
import { buildTranscriptContext, parseCitations } from '@lib/services/analysis/qa/index.js';

describe('QA transcript helpers', () => {
  it('formats transcript lines with stable one-decimal timestamps', () => {
    expect(
      buildTranscriptContext([
        { start: 1.24, duration: 2, text: 'First line' },
        { start: 63, duration: 1, text: 'Second line' },
      ]),
    ).toBe('[1.2s] First line\n[63.0s] Second line');
  });

  it('extracts unique minute and hour citations in encounter order', () => {
    expect(parseCitations('See [1:23], then [1:02:03], and again [1:23].')).toEqual([
      { label: '[1:23]', timeSec: 83 },
      { label: '[1:02:03]', timeSec: 3723 },
    ]);
  });

  it('ignores text that is not a complete timestamp citation', () => {
    expect(parseCitations('At 1:23, [1:2], or [abc].')).toEqual([]);
  });
});
