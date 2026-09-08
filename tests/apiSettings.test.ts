import { describe, it, expect, vi } from 'vitest';

/**
 * The operator gate on config writes.
 *
 * The token is planted in the environment before the config module loads and
 * freezes it, and the file store is mocked because a passing PATCH would
 * otherwise write to the developer's real ~/.config/video-clipper.
 */

const OPERATOR_TOKEN = 'test-operator-token';

vi.hoisted(() => {
  process.env.OPERATOR_TOKEN = 'test-operator-token';
});

vi.mock('../src/lib/config/fileStore.js', () => {
  let stored: Record<string, unknown> | null = null;
  return {
    getConfigDir: (): string => '/nonexistent',
    getConfigFilePath: (): string => '/nonexistent/config.json',
    loadUserConfig: (): Record<string, unknown> | null => stored,
    saveUserConfig: (values: Record<string, unknown>): void => {
      stored = values;
    },
  };
});

import { createApp } from '../src/app/api/app.js';

const app = createApp();

async function patchSettings(
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return await app.request('/api/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('reading settings', () => {
  it('stays open, and masks the operator token like any other secret', async () => {
    const res = await app.request('/api/settings');
    expect(res.status).toBe(200);

    const raw = await res.text();
    expect(raw).not.toContain(OPERATOR_TOKEN);

    const body = JSON.parse(raw) as { values: Record<string, unknown> };
    expect(body.values.OPERATOR_TOKEN).toMatchObject({ hasValue: true });
  });
});

describe('writing settings', () => {
  it('refuses a write with no token', async () => {
    const res = await patchSettings({ SCORE_THRESHOLD: 8 });
    expect(res.status).toBe(401);
  });

  it('refuses a write with the wrong token', async () => {
    const res = await patchSettings(
      { SCORE_THRESHOLD: 8 },
      { authorization: 'Bearer not-the-token' },
    );
    expect(res.status).toBe(401);
  });

  it('accepts a write carrying the operator token', async () => {
    const res = await patchSettings(
      { SCORE_THRESHOLD: 8 },
      { authorization: `Bearer ${OPERATOR_TOKEN}` },
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { success: boolean; values: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(body.values.SCORE_THRESHOLD).toBe(8);
  });

  it('still validates the payload after the gate', async () => {
    const res = await patchSettings(
      { SCORE_THRESHOLD: 99 },
      { authorization: `Bearer ${OPERATOR_TOKEN}` },
    );
    expect(res.status).toBe(400);
  });
});
