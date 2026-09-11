import { isIP } from 'node:net';

/**
 * Resolves a rate-limit identity without trusting caller-supplied forwarding
 * headers by default. A configured hop count walks X-Forwarded-For from the
 * right, which prevents values prepended by the original client from winning.
 */
export function resolveClientAddress(
  request: Request,
  trustedProxyHops: number,
  directAddress?: string,
): string {
  if (trustedProxyHops > 0) {
    const forwarded = (request.headers.get('x-forwarded-for') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const candidate = forwarded[forwarded.length - trustedProxyHops];
    if (candidate && isIP(candidate) !== 0) return candidate.toLowerCase();
  }

  return directAddress && isIP(directAddress) !== 0 ? directAddress.toLowerCase() : 'unknown';
}
