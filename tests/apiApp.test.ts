import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app/api/app.js';

const app = createApp();

describe('backend app', () => {
  it('answers health with the request id it assigned', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; requestId: string };
    expect(body.ok).toBe(true);
    expect(body.requestId).toBeTruthy();
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('honours a caller-supplied request id so logs can be correlated', async () => {
    const res = await app.request('/api/health', { headers: { 'x-request-id': 'caller-123' } });
    expect(res.headers.get('x-request-id')).toBe('caller-123');
  });

  it('returns unknown routes in the shared error envelope', async () => {
    const res = await app.request('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { message: 'Not found.' } });
  });
});
