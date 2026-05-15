import { describe, it, expect } from 'vitest';
import { buildRemuxOutputOptions } from '../../src/lib/services/video/clipper/index.js';

describe('buildRemuxOutputOptions', () => {
  it('emits the libx264 + aac transcode chain so DASH boundary drift is normalised', () => {
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
  });

  it('forwards the configured ffmpegPreset', () => {
    const opts = buildRemuxOutputOptions({ ffmpegPreset: 'ultrafast' });
    expect(opts).toContain('-preset');
    expect(opts[opts.indexOf('-preset') + 1]).toBe('ultrafast');
  });

  it('does NOT emit -c copy (the regression that left audio out of sync)', () => {
    const opts = buildRemuxOutputOptions({ ffmpegPreset: 'medium' });
    const joined = opts.join(' ');
    expect(joined).not.toMatch(/-c:v\s+copy/);
    expect(joined).not.toMatch(/-c:a\s+copy/);
  });

  it('keeps -avoid_negative_ts make_zero as a defensive flag', () => {
    const opts = buildRemuxOutputOptions({ ffmpegPreset: 'medium' });
    expect(opts).toContain('-avoid_negative_ts');
    expect(opts[opts.indexOf('-avoid_negative_ts') + 1]).toBe('make_zero');
  });
});
