import { describe, it, expect } from 'vitest';
import { buildMicroBlocks, buildLLMChunks } from '../src/services/chunkBuilder/index.js';
import type { TranscriptLine, MicroBlock } from '../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLine(start: number, duration: number, text: string): TranscriptLine {
  return { start, duration, text };
}

function makeBlock(start: number, end: number, text: string): MicroBlock {
  return { start, end, text };
}

// ---------------------------------------------------------------------------
// buildMicroBlocks
// ---------------------------------------------------------------------------

describe('buildMicroBlocks', () => {
  it('returns empty array for empty input', () => {
    expect(buildMicroBlocks([], 15)).toEqual([]);
  });

  it('groups a single line into one block', () => {
    const lines = [makeLine(0, 5, 'hello world')];
    const blocks = buildMicroBlocks(lines, 15);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].start).toBe(0);
    expect(blocks[0].text).toBe('hello world');
    expect(blocks[0].end).toBe(5); // 0 + 5
  });

  it('groups lines within the window into one block', () => {
    const lines = [
      makeLine(0, 3, 'line one'),
      makeLine(5, 3, 'line two'),
      makeLine(10, 3, 'line three'),
    ];
    const blocks = buildMicroBlocks(lines, 15);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('line one line two line three');
    expect(blocks[0].start).toBe(0);
    expect(blocks[0].end).toBe(13); // 10 + 3
  });

  it('starts a new block when a line falls outside the window', () => {
    const lines = [
      makeLine(0, 5, 'block one a'),
      makeLine(5, 5, 'block one b'),
      makeLine(15, 5, 'block two a'), // exactly at boundary
      makeLine(20, 5, 'block two b'),
    ];
    const blocks = buildMicroBlocks(lines, 15);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('block one a block one b');
    expect(blocks[1].text).toBe('block two a block two b');
  });

  it('creates multiple blocks for long transcripts', () => {
    // 6 lines, each 10s apart → should create 4 blocks with a 15s window
    const lines = Array.from({ length: 6 }, (_, i) => makeLine(i * 10, 5, `line ${i}`));
    const blocks = buildMicroBlocks(lines, 15);
    // line 0 (0s) and line 1 (10s) → block 1 [0–20)
    // line 2 (20s) and line 3 (30s) → block 2 [20–40)
    // line 4 (40s) and line 5 (50s) → block 3 [40–55]
    expect(blocks).toHaveLength(3);
    expect(blocks[0].start).toBe(0);
    expect(blocks[1].start).toBe(20);
    expect(blocks[2].start).toBe(40);
  });

  it('preserves start time of the first line in each block', () => {
    const lines = [makeLine(3, 5, 'first'), makeLine(25, 5, 'second')];
    const blocks = buildMicroBlocks(lines, 15);
    expect(blocks[0].start).toBe(3);
    expect(blocks[1].start).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// buildLLMChunks
// ---------------------------------------------------------------------------

describe('buildLLMChunks', () => {
  it('returns empty array for empty input', () => {
    expect(buildLLMChunks([], 120, 20)).toEqual([]);
  });

  it('returns a single chunk when all blocks fit within one window', () => {
    const blocks = [
      makeBlock(0, 30, 'first'),
      makeBlock(30, 60, 'second'),
      makeBlock(60, 90, 'third'),
    ];
    const chunks = buildLLMChunks(blocks, 120, 20);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].start).toBe(0);
    expect(chunks[0].text).toBe('first second third');
  });

  it('produces overlapping chunks', () => {
    // 12 blocks of 10s each → 120s total
    // chunkLen=60, overlap=20 → step=40
    // chunk 1: blocks starting 0–59s → [0,10,20,30,40,50]
    // chunk 2: blocks starting 40–99s → [40,50,60,70,80,90]
    // chunk 3: blocks starting 80–139s (capped at 120) → [80,90,100,110]
    const blocks = Array.from({ length: 12 }, (_, i) => makeBlock(i * 10, i * 10 + 10, `b${i}`));
    const chunks = buildLLMChunks(blocks, 60, 20);
    expect(chunks).toHaveLength(3);

    // Chunk 1: blocks 0–50
    expect(chunks[0].start).toBe(0);
    expect(chunks[0].text).toContain('b0');
    expect(chunks[0].text).toContain('b5');

    // Chunk 2 starts at 40 (step = 40 from 0)
    expect(chunks[1].start).toBe(40);
    expect(chunks[1].text).toContain('b4');
    expect(chunks[1].text).toContain('b9');

    // Overlap: b4 and b5 appear in both chunk 1 and chunk 2
    expect(chunks[0].text).toContain('b4');
    expect(chunks[1].text).toContain('b4');
  });

  it('does not produce empty chunks', () => {
    const blocks = [makeBlock(0, 10, 'only')];
    const chunks = buildLLMChunks(blocks, 120, 20);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('only');
  });

  it('chunk start is the start of the first included block', () => {
    const blocks = [makeBlock(5, 15, 'a'), makeBlock(15, 25, 'b')];
    const chunks = buildLLMChunks(blocks, 120, 20);
    expect(chunks[0].start).toBe(5);
  });

  it('chunk end is the end of the last included block', () => {
    const blocks = [makeBlock(0, 60, 'a'), makeBlock(60, 90, 'b')];
    const chunks = buildLLMChunks(blocks, 120, 20);
    expect(chunks[0].end).toBe(90);
  });
});
