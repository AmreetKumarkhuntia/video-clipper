import { describe, expect, it } from 'vitest';
import { rescaleWords, shiftWords, wordsFromText } from '@web/lib/subtitleTiming.js';

describe('subtitle timing', () => {
  it('distributes words evenly while preserving matching highlight choices', () => {
    expect(
      wordsFromText('one two', 10, 14, [{ text: 'old', startSec: 0, endSec: 1, highlight: true }]),
    ).toEqual([
      { text: 'one', startSec: 10, endSec: 12, highlight: true },
      { text: 'two', startSec: 12, endSec: 14, highlight: false },
    ]);
  });

  it('pins zero-duration words to the line start', () => {
    expect(wordsFromText('one two', 10, 10)).toEqual([
      { text: 'one', startSec: 10, endSec: 10, highlight: false },
      { text: 'two', startSec: 10, endSec: 10, highlight: false },
    ]);
  });

  it('shifts words without allowing negative timestamps', () => {
    expect(shiftWords([{ text: 'one', startSec: 1, endSec: 3, highlight: false }], -2)).toEqual([
      { text: 'one', startSec: 0, endSec: 1, highlight: false },
    ]);
  });

  it('rescales word timings into a new line window', () => {
    expect(
      rescaleWords([{ text: 'one', startSec: 11, endSec: 13, highlight: false }], 10, 14, 20, 28),
    ).toEqual([{ text: 'one', startSec: 22, endSec: 26, highlight: false }]);
  });
});
