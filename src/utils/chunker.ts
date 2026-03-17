/**
 * Generic windowed-chunker utility.
 *
 * Used by:
 *   - transcriptProcessor  — builds LLM analysis windows over micro-blocks
 *   - audioProcessor       — builds audio slice windows over the video duration
 *
 * The function returns non-overlapping or overlapping half-open intervals
 * [start, end) that together cover the full range [0, totalDuration).
 */

import type { ChunkWindow } from '../types/index.js';

export type { ChunkWindow };

/**
 * Builds a list of time windows covering `[0, totalDuration)`.
 *
 * @param totalDuration - Total duration of the content in seconds.
 * @param windowSec     - Width of each window in seconds. Must be > 0.
 * @param overlapSec    - How many seconds consecutive windows share. Must be
 *                        >= 0 and < windowSec. Defaults to 0.
 * @returns Array of {start, end} windows. Empty when totalDuration <= 0.
 *
 * @example
 * // No overlap — three equal windows
 * buildWindows(60, 20)
 * // → [{start:0,end:20}, {start:20,end:40}, {start:40,end:60}]
 *
 * @example
 * // With overlap — each window starts 10s after the previous
 * buildWindows(60, 30, 10)
 * // → [{start:0,end:30}, {start:20,end:50}, {start:40,end:60}]
 *
 * @example
 * // Remainder — last window is shorter
 * buildWindows(70, 30)
 * // → [{start:0,end:30}, {start:30,end:60}, {start:60,end:70}]
 */
export function buildWindows(
  totalDuration: number,
  windowSec: number,
  overlapSec: number = 0,
): ChunkWindow[] {
  if (totalDuration <= 0 || windowSec <= 0) return [];
  if (overlapSec < 0) overlapSec = 0;
  if (overlapSec >= windowSec) overlapSec = 0; // guard against infinite loop

  const step = windowSec - overlapSec;
  const windows: ChunkWindow[] = [];

  for (let start = 0; start < totalDuration; start += step) {
    windows.push({
      start,
      end: Math.min(start + windowSec, totalDuration),
    });
  }

  return windows;
}
