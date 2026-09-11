import { describe, expect, it } from 'vitest';
import {
  parseChannelInput,
  parseYouTubeDuration,
} from '@lib/services/video/source/youtube/catalog.js';

describe('parseChannelInput', () => {
  it.each([
    ['@creator', { kind: 'handle', value: '@creator' }],
    ['creator', { kind: 'handle', value: 'creator' }],
    ['UC12345678901234567890', { kind: 'id', value: 'UC12345678901234567890' }],
    [
      'https://youtube.com/channel/UC12345678901234567890',
      { kind: 'id', value: 'UC12345678901234567890' },
    ],
    ['https://youtube.com/user/creator', { kind: 'username', value: 'creator' }],
    ['https://youtube.com/@creator/videos', { kind: 'handle', value: '@creator' }],
  ] as const)('normalizes %s', (input, expected) => {
    expect(parseChannelInput(input)).toEqual(expected);
  });

  it('rejects blank input', () => {
    expect(() => parseChannelInput('   ')).toThrow('Channel input is required.');
  });
});

describe('parseYouTubeDuration', () => {
  it.each([
    [undefined, 0],
    [null, 0],
    ['invalid', 0],
    ['PT45S', 45],
    ['PT1H2M3S', 3723],
    ['P1DT2H3M4S', 93784],
  ] as const)('converts %s to seconds', (input, expected) => {
    expect(parseYouTubeDuration(input)).toBe(expected);
  });
});
