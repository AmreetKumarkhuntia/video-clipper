import type { TranscriptLine, MicroBlock, LLMChunk } from '../../types/index.js';

/**
 * Groups raw transcript lines into micro-blocks of approximately `windowSec` seconds.
 *
 * A new block starts whenever the next line's `start` falls outside the current window.
 * Empty input returns an empty array.
 */
export function buildMicroBlocks(lines: TranscriptLine[], windowSec: number): MicroBlock[] {
  if (lines.length === 0) return [];

  const blocks: MicroBlock[] = [];
  let windowStart = lines[0].start;
  let texts: string[] = [];

  for (const line of lines) {
    if (line.start >= windowStart + windowSec) {
      // Flush current block
      blocks.push({
        start: windowStart,
        end: line.start,
        text: texts.join(' '),
      });
      // Start a new window aligned to the current line
      windowStart = line.start;
      texts = [];
    }
    texts.push(line.text);
  }

  // Flush the final block
  if (texts.length > 0) {
    const lastLine = lines[lines.length - 1];
    blocks.push({
      start: windowStart,
      end: lastLine.start + lastLine.duration,
      text: texts.join(' '),
    });
  }

  return blocks;
}

/**
 * Groups micro-blocks into larger LLM analysis chunks using a sliding window
 * of `chunkLen` seconds with `overlap` seconds of overlap between consecutive chunks.
 *
 * Each chunk spans from the first block whose `start >= chunkStart` to the last block
 * whose `start < chunkStart + chunkLen`. The next chunk starts at
 * `chunkStart + chunkLen - overlap`.
 *
 * Empty input returns an empty array.
 */
export function buildLLMChunks(
  blocks: MicroBlock[],
  chunkLen: number,
  overlap: number
): LLMChunk[] {
  if (blocks.length === 0) return [];

  const chunks: LLMChunk[] = [];
  const totalEnd = blocks[blocks.length - 1].end;
  let chunkStart = blocks[0].start;

  while (chunkStart < totalEnd) {
    const chunkEnd = chunkStart + chunkLen;

    const window = blocks.filter(b => b.start >= chunkStart && b.start < chunkEnd);

    if (window.length > 0) {
      chunks.push({
        start: window[0].start,
        end: window[window.length - 1].end,
        text: window.map(b => b.text).join(' '),
      });
    }

    const step = chunkLen - overlap;
    chunkStart += step;

    // Guard: if overlap >= chunkLen we'd loop forever
    if (step <= 0) break;
  }

  return chunks;
}
