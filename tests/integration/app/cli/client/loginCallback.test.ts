import { afterEach, describe, expect, it } from 'vitest';
import { createConnection } from 'node:net';
import { get } from 'node:http';
import { startLoginCallback } from '@app/cli/client/loginCallback.js';
import { CliLoopbackRedirectUriSchema } from '@lib/types/cliAuth.js';
import type { CliCallbackListener } from '@lib/types/cliAuth.js';

const state = 'a'.repeat(43);
const code = 'b'.repeat(43);
let listener: CliCallbackListener | undefined;

afterEach(async (): Promise<void> => {
  await listener?.close();
  listener = undefined;
});

async function start(timeoutMs = 10_000, signal?: AbortSignal): Promise<CliCallbackListener> {
  listener = await startLoginCallback({ state, timeoutMs, signal });
  return listener;
}

describe('CLI browser callback listener', (): void => {
  it('receives a state-bound exchange code and closes its listening port', async (): Promise<void> => {
    const active = await start();
    expect(CliLoopbackRedirectUriSchema.safeParse(active.redirectUri).success).toBe(true);
    const response = await fetch(`${active.redirectUri}?state=${state}&code=${code}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain(code);
    await expect(active.result).resolves.toEqual({ state, code });
    await active.close();
    await expect(fetch(active.redirectUri)).rejects.toThrow();
  });

  it('rejects malformed callbacks without preventing the subsequent valid callback', async (): Promise<void> => {
    const active = await start();
    const invalidQueries = [
      `state=${'c'.repeat(43)}&code=${code}`,
      `state=${state}&code=${code}&state=${state}`,
      `state=${state}&code=${code}&unexpected=value`,
      `state=${state}&code=${code}&error=provider_denied`,
      `state=${state}&error=untrusted-message`,
      `state=${state}&code=short`,
      `code=${code}`,
    ];
    for (const query of invalidQueries) {
      const response = await fetch(`${active.redirectUri}?${query}`);
      expect(response.status).toBe(400);
      await response.text();
    }
    const response = await fetch(`${active.redirectUri}?state=${state}&code=${code}`);
    expect(response.status).toBe(200);
    await response.text();
    await expect(active.result).resolves.toEqual({ state, code });
  });

  it('rejects alternate routes, methods and Host headers', async (): Promise<void> => {
    const active = await start();
    const url = `${active.redirectUri}?state=${state}&code=${code}`;
    const wrongPath = await fetch(url.replace('/callback', '/other'));
    expect(wrongPath.status).toBe(404);
    await wrongPath.text();
    const wrongMethod = await fetch(url, { method: 'POST' });
    expect(wrongMethod.status).toBe(405);
    await wrongMethod.text();
    const wrongHost = await new Promise<number | undefined>((resolve, reject): void => {
      get(url, { headers: { host: 'untrusted.example' } }, (response): void => {
        response.resume();
        resolve(response.statusCode);
      }).once('error', reject);
    });
    expect(wrongHost).toBe(404);
    const valid = await fetch(url);
    expect(valid.status).toBe(200);
    await valid.text();
    await expect(active.result).resolves.toEqual({ state, code });
  });

  it('returns a known provider denial without exposing it in the browser response', async (): Promise<void> => {
    const active = await start();
    const response = await fetch(`${active.redirectUri}?state=${state}&error=provider_denied`);
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('provider_denied');
    await expect(active.result).resolves.toEqual({ state, error: 'provider_denied' });
  });

  it('times out and closes its port', async (): Promise<void> => {
    const active = await start(20);
    await expect(active.result).rejects.toThrow('Sign-in timed out');
    await active.close();
    await expect(fetch(active.redirectUri)).rejects.toThrow();
  });

  it('cancels and closes even an unfinished incoming connection', async (): Promise<void> => {
    const controller = new AbortController();
    const active = await start(10_000, controller.signal);
    const socket = createConnection(Number(new URL(active.redirectUri).port), '127.0.0.1');
    await new Promise<void>((resolve, reject): void => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    socket.write('GET /callback HTTP/1.1\r\n');
    const closed = new Promise<void>((resolve): void => {
      socket.once('close', (): void => resolve());
    });
    controller.abort();
    await expect(active.result).rejects.toThrow('Sign-in cancelled');
    await active.close();
    await closed;
    await expect(fetch(active.redirectUri)).rejects.toThrow();
  });

  it('does not start a listener for an already-cancelled login', async (): Promise<void> => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      startLoginCallback({ state, timeoutMs: 10_000, signal: controller.signal }),
    ).rejects.toThrow('cancelled');
  });
});
