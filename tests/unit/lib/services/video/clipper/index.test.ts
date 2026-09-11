import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RankedSegment } from '@lib/types/segment.js';
import type { ClipperConfig } from '@lib/types/video.js';

const ffmpegMock = vi.hoisted(() => vi.fn());

vi.mock('fluent-ffmpeg', () => ({
  default: Object.assign(ffmpegMock, {
    setFfmpegPath: vi.fn(),
    setFfprobePath: vi.fn(),
  }),
}));

import {
  buildRemuxOutputOptions,
  generateClips,
  remuxClips,
} from '@lib/services/video/clipper/index.js';

const CONFIG: ClipperConfig = {
  timestampOffset: 0,
  ffmpegPreset: 'veryfast',
  outputDir: '/unused',
};
const SEGMENT: RankedSegment = {
  start: 10.2,
  end: 20.3,
  score: 9,
  rank: 1,
  reason: 'test segment',
  source: 'transcript',
};

let outputDir: string;

beforeEach(async () => {
  outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vc-clipper-test-'));
  ffmpegMock.mockClear();
});

afterEach(async () => {
  await fs.rm(outputDir, { recursive: true, force: true });
});

describe('buildRemuxOutputOptions', () => {
  it('builds the configured transcode chain that normalizes DASH boundary drift', () => {
    const opts = buildRemuxOutputOptions({ ffmpegPreset: 'veryfast' });

    expect(opts).toEqual([
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-c:a',
      'aac',
      '-avoid_negative_ts',
      'make_zero',
    ]);
    expect(opts.join(' ')).not.toContain('copy');
  });
});

describe('clip output cache', () => {
  it('returns an existing generated clip without invoking ffmpeg', async () => {
    const cachedPath = path.join(outputDir, 'dQw4w9WgXcQ_10_21.mp4');
    await fs.writeFile(cachedPath, 'cached');

    await expect(
      generateClips('/input/video.mp4', [SEGMENT], 'dQw4w9WgXcQ', CONFIG, outputDir),
    ).resolves.toEqual([cachedPath]);
    expect(ffmpegMock).not.toHaveBeenCalled();
  });

  it('returns an existing remuxed clip without invoking ffmpeg', async () => {
    const sourcePath = '/downloads/dQw4w9WgXcQ_10_21.mp4';
    const cachedPath = path.join(outputDir, path.basename(sourcePath));
    await fs.writeFile(cachedPath, 'cached');

    await expect(remuxClips([sourcePath], 'dQw4w9WgXcQ', CONFIG, outputDir)).resolves.toEqual([
      cachedPath,
    ]);
    expect(ffmpegMock).not.toHaveBeenCalled();
  });
});
