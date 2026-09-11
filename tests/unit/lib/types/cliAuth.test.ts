import { describe, expect, it } from 'vitest';
import { CliLoopbackRedirectUriSchema } from '@lib/types/cliAuth.js';

describe('CliLoopbackRedirectUriSchema', () => {
  it.each([
    'http://127.0.0.1:1/callback',
    'http://127.0.0.1:49152/callback',
    'http://127.0.0.1:65535/callback',
  ])('accepts canonical loopback URL %s', (url) => {
    expect(CliLoopbackRedirectUriSchema.safeParse(url).success).toBe(true);
  });

  it.each([
    'https://127.0.0.1:5000/callback',
    'http://localhost:5000/callback',
    'http://127.1:5000/callback',
    'http://2130706433:5000/callback',
    'http://0x7f000001:5000/callback',
    'http://0177.0.0.1:5000/callback',
    'http://[::1]:5000/callback',
    'http://0.0.0.0:5000/callback',
    'http://127.0.0.1/callback',
    'http://127.0.0.1:0/callback',
    'http://127.0.0.1:65536/callback',
    'http://127.0.0.1:05000/callback',
    'http://user@127.0.0.1:5000/callback',
    'http://127.0.0.1:5000/callback?x=1',
    'http://127.0.0.1:5000/callback#fragment',
    'http://127.0.0.1:5000/other/../callback',
    'http://127.0.0.1:5000/callback/',
    'http://127.0.0.1:5000/call%62ack',
    ' http://127.0.0.1:5000/callback',
  ])('rejects alternate or normalized URL %s', (url) => {
    expect(CliLoopbackRedirectUriSchema.safeParse(url).success).toBe(false);
  });
});
