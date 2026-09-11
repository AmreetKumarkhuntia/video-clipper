import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloaderConfig } from '@lib/types/downloader.js';
import type { RankedSegment } from '@lib/types/segment.js';

const execaMock = vi.hoisted(() => vi.fn());

vi.mock('execa', () => ({ execa: execaMock }));

import { downloadVideo } from '@lib/services/video/index.js';

const SEGMENT: RankedSegment = {
  start: 10,
  end: 20,
  score: 9,
  rank: 1,
  reason: 'test segment',
  source: 'transcript',
};

let downloadDir: string;

function config(overrides: Partial<DownloaderConfig> = {}): DownloaderConfig {
  return {
    downloadDir,
    timestampOffset: 0,
    llmConcurrency: 1,
    quiet: true,
    retryCount: 0,
    cookiesFromBrowser: 'chrome:Profile 1',
    ...overrides,
  };
}

function lastYtDlpArgs(): string[] {
  expect(execaMock).toHaveBeenCalledOnce();
  return execaMock.mock.calls[0]?.[1] as string[];
}

beforeEach(async () => {
  downloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vc-downloader-test-'));
  execaMock.mockResolvedValue(undefined);
});

afterEach(async () => {
  await fs.rm(downloadDir, { recursive: true, force: true });
  execaMock.mockReset();
});

describe('yt-dlp cookie policy', () => {
  it('omits configured cookies from segment downloads by default', async () => {
    await downloadVideo('dQw4w9WgXcQ', 'segments', [SEGMENT], config());

    const args = lastYtDlpArgs();
    expect(args).not.toContain('--cookies-from-browser');
    expect(args).not.toContain('--cookies');
    expect(args).toContain('--download-sections');
  });

  it('passes configured cookies to full-video downloads', async () => {
    await downloadVideo('dQw4w9WgXcQ', 'all', [], config());

    const args = lastYtDlpArgs();
    expect(args.slice(0, 2)).toEqual(['--cookies-from-browser', 'chrome:Profile 1']);
    expect(args).not.toContain('--download-sections');
  });
});
