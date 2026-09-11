import { describe, expect, it } from 'vitest';
import { sanitizeReturnTo } from '@app/api/http/sessionCookies.js';

describe('sanitizeReturnTo', () => {
  it.each(['/dashboard', '/videos/abc?tab=clips'])('keeps same-origin path %j', (value) => {
    expect(sanitizeReturnTo(value)).toBe(value);
  });

  it.each([
    undefined,
    '',
    'relative/path',
    '//evil.com',
    '/\\evil.com',
    '/\\/evil.com',
    '\\evil.com',
    'https://evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
  ])('falls back to root for unsafe destination %j', (value) => {
    expect(sanitizeReturnTo(value)).toBe('/');
  });
});
