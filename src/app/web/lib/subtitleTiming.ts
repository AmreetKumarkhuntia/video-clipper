import type { WordToken } from '@lib/types/clipEdit.js';

export function wordsFromText(
  text: string,
  startSec: number,
  endSec: number,
  prev: WordToken[] = [],
): WordToken[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const dur = endSec - startSec;
  if (dur <= 0) {
    return tokens.map((t, i) => ({
      text: t,
      startSec,
      endSec,
      highlight: prev[i]?.highlight ?? false,
    }));
  }
  const step = dur / tokens.length;
  return tokens.map((t, i) => ({
    text: t,
    startSec: startSec + i * step,
    endSec: startSec + (i + 1) * step,
    highlight: prev[i]?.highlight ?? false,
  }));
}

export function shiftWords(words: WordToken[], delta: number): WordToken[] {
  if (delta === 0 || words.length === 0) return words;
  return words.map((w) => ({
    ...w,
    startSec: Math.max(0, w.startSec + delta),
    endSec: Math.max(0, w.endSec + delta),
  }));
}

export function rescaleWords(
  words: WordToken[],
  oldStart: number,
  oldEnd: number,
  newStart: number,
  newEnd: number,
): WordToken[] {
  if (words.length === 0) return words;
  const oldDur = oldEnd - oldStart;
  const newDur = newEnd - newStart;
  if (oldDur <= 0 || newDur <= 0) return words;
  const scale = newDur / oldDur;
  return words.map((w) => ({
    ...w,
    startSec: newStart + (w.startSec - oldStart) * scale,
    endSec: newStart + (w.endSec - oldStart) * scale,
  }));
}
