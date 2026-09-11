import { describe, expect, it } from 'vitest';
import { formatTimecode, parseTimecode } from '@web/lib/format.js';

describe('editor timecodes', () => {
  it.each([
    [0, '00:00.000'],
    [65.125, '01:05.125'],
    [-1, '00:00.000'],
  ] as const)('formats %s seconds', (seconds, expected) => {
    expect(formatTimecode(seconds)).toBe(expected);
  });

  it.each([
    ['01:05.125', 65.125],
    ['1:05.1', 65.1],
    ['00:59', 59],
  ] as const)('parses %s', (input, expected) => {
    expect(parseTimecode(input)).toBe(expected);
  });

  it.each(['1:60', 'seconds', '1:2:3'])('rejects invalid timecode %s', (input) => {
    expect(parseTimecode(input)).toBeNull();
  });
});
