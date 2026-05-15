import { describe, it, expect } from 'vitest';
import { normalizeWordTimings } from '../src/app/web/lib/services/subtitles/subtitlePlanService.js';
import type { PlannedSubtitleLine } from '../src/app/web/types/subtitlePlan.js';

function makeLine(overrides: Partial<PlannedSubtitleLine> = {}): PlannedSubtitleLine {
  return {
    startSec: 0,
    endSec: 1,
    text: '',
    words: [],
    ...overrides,
  };
}

describe('normalizeWordTimings', () => {
  it('redistributes zero-duration leading words across the line window', () => {
    const line = makeLine({
      startSec: 0,
      endSec: 1.45,
      text: 'For generations, our families',
      words: [
        { text: 'For', startSec: 0, endSec: 0 },
        { text: 'generations,', startSec: 0, endSec: 0 },
        { text: 'our', startSec: 0, endSec: 0 },
        { text: 'families', startSec: 0, endSec: 1.45 },
      ],
    });

    const out = normalizeWordTimings(line);

    expect(out.words).toHaveLength(4);
    for (let i = 0; i < out.words.length; i++) {
      expect(out.words[i].endSec).toBeGreaterThan(out.words[i].startSec);
      if (i > 0) {
        expect(out.words[i].startSec).toBeGreaterThanOrEqual(out.words[i - 1].endSec);
      }
    }
    expect(out.words[0].startSec).toBe(0);
    expect(out.words[out.words.length - 1].endSec).toBeCloseTo(1.45, 6);
  });

  it('passes through already-good timings unchanged', () => {
    const line = makeLine({
      startSec: 1.45,
      endSec: 3.36,
      text: 'have lived by a code.',
      words: [
        { text: 'have', startSec: 1.45, endSec: 1.9 },
        { text: 'lived', startSec: 1.9, endSec: 2.3 },
        { text: 'by', startSec: 2.3, endSec: 2.7 },
        { text: 'a', startSec: 2.7, endSec: 3.0 },
        { text: 'code.', startSec: 3.0, endSec: 3.36 },
      ],
    });

    const out = normalizeWordTimings(line);

    expect(out).toBe(line);
  });

  it('clamps words exceeding line.endSec back into the window', () => {
    const line = makeLine({
      startSec: 0,
      endSec: 2,
      text: 'one two',
      words: [
        { text: 'one', startSec: 0, endSec: 1 },
        { text: 'two', startSec: 1, endSec: 5 },
      ],
    });

    const out = normalizeWordTimings(line);

    expect(out.words[1].endSec).toBeLessThanOrEqual(2);
    expect(out.words[1].endSec).toBeGreaterThan(out.words[1].startSec);
  });

  it('corrects reversed endSec < startSec by redistributing', () => {
    const line = makeLine({
      startSec: 0,
      endSec: 2,
      text: 'one two',
      words: [
        { text: 'one', startSec: 1, endSec: 0.5 },
        { text: 'two', startSec: 0, endSec: 0 },
      ],
    });

    const out = normalizeWordTimings(line);

    for (const w of out.words) {
      expect(w.endSec).toBeGreaterThan(w.startSec);
    }
    expect(out.words[1].startSec).toBeGreaterThanOrEqual(out.words[0].endSec);
  });

  it('returns the line unchanged when words array is empty', () => {
    const line = makeLine({ startSec: 0, endSec: 1, text: '...', words: [] });
    expect(normalizeWordTimings(line)).toBe(line);
  });
});
