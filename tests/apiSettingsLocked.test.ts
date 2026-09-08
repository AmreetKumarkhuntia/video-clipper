import { describe, it, expect, vi } from 'vitest';

/**
 * Its own file because config freezes at module load: the unlocked suite plants
 * a token before that happens, so the locked case needs a fresh module graph.
 * An empty string rather than a delete, because dotenv would silently refill a
 * deleted variable from a developer's .env and an empty one it leaves alone.
 */

vi.hoisted(() => {
  process.env.OPERATOR_TOKEN = '';
});

vi.mock('../src/lib/config/fileStore.js', () => ({
  getConfigDir: (): string => '/nonexistent',
  getConfigFilePath: (): string => '/nonexistent/config.json',
  loadUserConfig: (): Record<string, unknown> | null => null,
  saveUserConfig: (): void => {},
}));

import { createApp } from '../src/app/api/app.js';

describe('settings with no operator token configured', () => {
  it('locks writes rather than leaving them open', async () => {
    const res = await createApp().request('/api/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: 'Bearer anything' },
      body: JSON.stringify({ SCORE_THRESHOLD: 8 }),
    });
    expect(res.status).toBe(403);

    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('Settings are locked');
  });
});
