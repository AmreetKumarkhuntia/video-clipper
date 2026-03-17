import { describe, it, expect } from 'vitest';
import { normalizeGeminiTime } from '../src/services/audioEventDetector/index.js';

const CHUNK = 120; // default chunk duration in seconds

describe('normalizeGeminiTime', () => {
  // --- MM.SS format (frac ≤ 0.59, MM.SS result within chunk) ---

  it('converts 0.41 (MM.SS: 0min 41sec) to 41', () => {
    expect(normalizeGeminiTime(0.41, CHUNK)).toBe(41);
  });

  it('converts 0.55 (MM.SS: 0min 55sec) to 55', () => {
    expect(normalizeGeminiTime(0.55, CHUNK)).toBe(55);
  });

  it('converts 1.03 (MM.SS: 1min 3sec) to 63', () => {
    expect(normalizeGeminiTime(1.03, CHUNK)).toBe(63);
  });

  it('converts 1.40 (MM.SS: 1min 40sec) to 100', () => {
    expect(normalizeGeminiTime(1.4, CHUNK)).toBe(100);
  });

  it('converts 1.59 (MM.SS: 1min 59sec) to 119', () => {
    expect(normalizeGeminiTime(1.59, CHUNK)).toBe(119);
  });

  it('converts 0.00 to 0', () => {
    expect(normalizeGeminiTime(0.0, CHUNK)).toBe(0);
  });

  // --- True decimal seconds (frac > 0.59 → cannot be MM.SS) ---

  it('treats 53.403 as true decimal seconds (frac > 0.59)', () => {
    expect(normalizeGeminiTime(53.403, CHUNK)).toBe(53.403);
  });

  it('treats 110.273 as true decimal seconds (frac > 0.59)', () => {
    expect(normalizeGeminiTime(110.273, CHUNK)).toBe(110.273);
  });

  it('treats 12.396 as true decimal seconds (frac > 0.59)', () => {
    expect(normalizeGeminiTime(12.396, CHUNK)).toBe(12.396);
  });

  it('treats 0.7 as true decimal seconds (frac > 0.59)', () => {
    expect(normalizeGeminiTime(0.7, CHUNK)).toBe(0.7);
  });

  // --- MM.SS overflows chunk → falls back to decimal seconds ---

  it('falls back to decimal seconds when MM.SS result exceeds chunk duration', () => {
    // 2.30 as MM.SS = 2min 30sec = 150s, which exceeds 120s chunk → use 2.30 as-is
    expect(normalizeGeminiTime(2.3, CHUNK)).toBe(2.3);
  });

  it('falls back to decimal for value already near chunk boundary', () => {
    // 2.00 as MM.SS = 120s, which equals chunk duration (not < chunk) → use 2.00 as-is
    expect(normalizeGeminiTime(2.0, CHUNK)).toBe(2.0);
  });

  // --- Edge: large chunk duration ---

  it('converts MM.SS correctly when chunk is large enough to contain it', () => {
    // 12.05 as MM.SS = 12min 5sec = 725s, within a 900s chunk
    expect(normalizeGeminiTime(12.05, 900)).toBe(725);
  });
});
