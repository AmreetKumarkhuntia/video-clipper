import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseArgs } from '@app/cli/args.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseArgs', () => {
  it('parses the run command options that change pipeline behavior', () => {
    expect(
      parseArgs([
        'node',
        'video-clipper',
        'https://youtu.be/dQw4w9WgXcQ',
        '--download-sections',
        '3',
        '--threshold',
        '8',
        '--top-n',
        '5',
        '--max-chunks',
        '2',
        '--max-parallel',
        '4',
        '--no-cache',
      ]),
    ).toMatchObject({
      url: 'https://youtu.be/dQw4w9WgXcQ',
      clip: true,
      downloadSections: 3,
      threshold: 8,
      topN: 5,
      maxChunks: 2,
      maxParallel: 4,
      noCache: true,
    });
  });

  it.each(['--help', '-h'])('recognizes %s', (flag) => {
    expect(parseArgs(['node', 'video-clipper', flag]).help).toBe(true);
  });

  it('keeps full-video mode and implies clip generation', () => {
    expect(parseArgs(['node', 'video-clipper', '--download-sections', 'all'])).toMatchObject({
      downloadSections: 'all',
      clip: true,
    });
  });

  it.each([
    ['--download-sections', '0'],
    ['--max-chunks', '1.5'],
    ['--max-parallel', '0'],
    ['--threshold', 'not-a-number'],
    ['--unknown', undefined],
  ] as const)('exits for invalid option %s %s', (flag, value) => {
    vi.spyOn(process, 'exit').mockImplementation((code): never => {
      throw new Error(`exit:${String(code)}`);
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const argv = ['node', 'video-clipper', flag];
    if (value !== undefined) argv.push(value);

    expect(() => parseArgs(argv)).toThrow('exit:1');
  });
});
