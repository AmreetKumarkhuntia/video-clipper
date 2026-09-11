import { describe, expect, it } from 'vitest';
import { resolveClientAddress } from '@app/api/services/clientAddress.js';

describe('resolveClientAddress', () => {
  const forwarded = new Request('http://localhost', {
    headers: { 'x-forwarded-for': '198.51.100.20, 203.0.113.20' },
  });

  it.each([
    [0, '192.0.2.20'],
    [1, '203.0.113.20'],
    [2, '198.51.100.20'],
    [3, '192.0.2.20'],
  ])('uses the address selected by %s trusted proxy hops', (trustedProxyHops, expected) => {
    expect(resolveClientAddress(forwarded, trustedProxyHops, '192.0.2.20')).toBe(expected);
  });

  it('falls back to a valid direct address when forwarding data is invalid', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': 'invalid' },
    });

    expect(resolveClientAddress(request, 1, '192.0.2.20')).toBe('192.0.2.20');
  });

  it('returns unknown when neither source contains a valid address', () => {
    expect(resolveClientAddress(new Request('http://localhost'), 1, 'invalid')).toBe('unknown');
  });
});
