import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app/api/app.js';

const app = createApp();

async function errorBody(res: Response): Promise<{ message: string; detail?: string }> {
  const body = (await res.json()) as { error: { message: string; detail?: string } };
  return body.error;
}

describe('backend app', () => {
  it('answers health with the request id it assigned', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; requestId: string };
    expect(body.ok).toBe(true);
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('honours a caller-supplied request id so logs can be correlated', async () => {
    const res = await app.request('/api/health', { headers: { 'x-request-id': 'caller-123' } });
    expect(res.headers.get('x-request-id')).toBe('caller-123');
  });

  it('returns unknown routes in the shared error envelope', async () => {
    const res = await app.request('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(await errorBody(res)).toEqual({ message: 'Not found.' });
  });
});

// The prototype answered 400 for a bad body. These lock that in, because the
// error path runs through onError rather than a middleware try/catch — a
// distinction that silently turned every 400 into a 500 when first written.
describe('error envelope', () => {
  it('maps a malformed JSON body to 400, not 500', async () => {
    const res = await app.request('/api/caption-presets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).message).toBe('Request body must be valid JSON.');
  });

  it('maps a schema violation to 400 with the offending field', async () => {
    const res = await app.request('/api/caption-presets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);

    const { message, detail } = await errorBody(res);
    expect(message).toBe('Invalid request.');
    expect(detail).toBeTruthy();
  });

  it('still echoes the request id on an error response', async () => {
    const res = await app.request('/api/caption-presets', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'err-42' },
      body: '{ not json',
    });
    expect(res.headers.get('x-request-id')).toBe('err-42');
  });
});

describe('route mounting', () => {
  it('mounts every group, so no ported route 404s', async () => {
    // A 404 here would mean the group is unmounted; any other status means the
    // route exists and its own handler ran.
    const probes = [
      '/api/youtube/channels/resolve?input=x',
      '/api/youtube/connection',
      '/api/analyses',
      '/api/clips',
      '/api/caption-presets',
      '/api/settings',
    ];
    for (const path of probes) {
      const res = await app.request(path);
      expect(res.status, `${path} should be mounted`).not.toBe(404);
    }
  });
});
