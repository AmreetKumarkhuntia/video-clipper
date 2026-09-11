import { describe, expect, it } from 'vitest';
import { normalizeGeminiTime } from '@lib/services/audio/analyzer/gemini.js';

describe('normalizeGeminiTime', () => {
  it.each([
    [0, 120, 0],
    [0.41, 120, 41],
    [0.55, 120, 55],
    [1.03, 120, 63],
    [1.4, 120, 100],
    [1.59, 120, 119],
    [12.05, 900, 725],
  ])('interprets %s as MM.SS when it fits a %ss chunk', (value, chunkDuration, expected) => {
    expect(normalizeGeminiTime(value, chunkDuration)).toBe(expected);
  });

  it.each([
    [53.403, 120],
    [110.273, 120],
    [12.396, 120],
    [0.7, 120],
    [2.3, 120],
    [2, 120],
  ])(
    'keeps %s as decimal seconds when MM.SS is invalid for a %ss chunk',
    (value, chunkDuration) => {
      expect(normalizeGeminiTime(value, chunkDuration)).toBe(value);
    },
  );
});
