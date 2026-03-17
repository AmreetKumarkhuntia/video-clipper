import { describe, it, expect } from 'vitest';
import { buildWindows } from '../src/utils/chunker.js';

describe('buildWindows', () => {
  it('returns empty array when totalDuration is 0', () => {
    expect(buildWindows(0, 30)).toEqual([]);
  });

  it('returns empty array when totalDuration is negative', () => {
    expect(buildWindows(-10, 30)).toEqual([]);
  });

  it('returns empty array when windowSec is 0', () => {
    expect(buildWindows(60, 0)).toEqual([]);
  });

  it('returns empty array when windowSec is negative', () => {
    expect(buildWindows(60, -5)).toEqual([]);
  });

  it('produces non-overlapping equal windows with no overlap', () => {
    const windows = buildWindows(60, 20);
    expect(windows).toEqual([
      { start: 0, end: 20 },
      { start: 20, end: 40 },
      { start: 40, end: 60 },
    ]);
  });

  it('clips the last window end to totalDuration', () => {
    const windows = buildWindows(70, 30);
    expect(windows).toEqual([
      { start: 0, end: 30 },
      { start: 30, end: 60 },
      { start: 60, end: 70 },
    ]);
  });

  it('handles exact-fit duration (no remainder)', () => {
    const windows = buildWindows(90, 30);
    expect(windows).toHaveLength(3);
    expect(windows[2]).toEqual({ start: 60, end: 90 });
  });

  it('produces overlapping windows when overlapSec > 0', () => {
    const windows = buildWindows(60, 30, 10);
    // step = 30 - 10 = 20
    expect(windows).toEqual([
      { start: 0, end: 30 },
      { start: 20, end: 50 },
      { start: 40, end: 60 },
    ]);
  });

  it('first window starts at 0', () => {
    const windows = buildWindows(100, 25);
    expect(windows[0].start).toBe(0);
  });

  it('last window end does not exceed totalDuration', () => {
    for (const [dur, win, ov] of [
      [100, 30, 0],
      [100, 30, 10],
      [77, 20, 5],
    ] as [number, number, number][]) {
      const ws = buildWindows(dur, win, ov);
      for (const w of ws) {
        expect(w.end).toBeLessThanOrEqual(dur);
      }
    }
  });

  it('all windows have positive width', () => {
    const windows = buildWindows(55, 20, 5);
    for (const w of windows) {
      expect(w.end).toBeGreaterThan(w.start);
    }
  });

  it('treats negative overlapSec as 0', () => {
    const withNeg = buildWindows(60, 20, -10);
    const withZero = buildWindows(60, 20, 0);
    expect(withNeg).toEqual(withZero);
  });

  it('treats overlapSec >= windowSec as 0 (avoids infinite loop)', () => {
    const windows = buildWindows(60, 20, 20);
    expect(windows).toEqual(buildWindows(60, 20, 0));
  });

  it('handles a single-window case (duration <= windowSec)', () => {
    const windows = buildWindows(15, 30);
    expect(windows).toEqual([{ start: 0, end: 15 }]);
  });
});
