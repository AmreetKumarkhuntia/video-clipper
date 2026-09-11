import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashSessionToken } from '../src/lib/utils/sessionToken.js';
import { SESSION_COOKIE_NAME } from '../src/lib/types/api.js';

/**
 * The permission gate on config writes.
 *
 * The file store is mocked because a passing PATCH would otherwise write to the
 * developer's real ~/.config/video-clipper; the database is a throwaway one
 * because these tests create customers and sessions.
 */

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
import {
  createCustomer,
  initDb,
  insertSession,
  runMigrations,
  setCustomerRole,
} from '../src/lib/services/db/index.js';

const app = createApp();
const CUSTOMER_TOKEN = 'customer-session';
const ADMIN_TOKEN = 'admin-session';

function cookie(token: string): Record<string, string> {
  return { cookie: `${SESSION_COOKIE_NAME}=${token}` };
}

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

async function errorOf(res: Response): Promise<{ message: string; detail?: string }> {
  return ((await res.json()) as { error: { message: string; detail?: string } }).error;
}

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-api-settings-'));
  initDb(path.join(dir, 'library.sqlite'));
  runMigrations();

  const customer = createCustomer({ email: 'someone@example.com' });
  insertSession(hashSessionToken(CUSTOMER_TOKEN), customer.id, Date.now() + 60_000);

  const admin = createCustomer({ email: 'admin@example.com' });
  setCustomerRole(admin.id, 'admin');
  insertSession(hashSessionToken(ADMIN_TOKEN), admin.id, Date.now() + 60_000);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('reading settings', () => {
  it('stays open, and no longer knows an operator token', async () => {
    const res = await app.request('/api/settings');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { values: Record<string, unknown> };
    expect(body.values).not.toHaveProperty('OPERATOR_TOKEN');
  });

  it('never exposes the deployment encryption key, even in masked values or the registry', async () => {
    const secret = Buffer.alloc(32, 7).toString('base64');
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', secret);
    const res = await app.request('/api/settings');
    const body = await res.text();
    expect(body).not.toContain(secret);
    expect(body).not.toContain('TOKEN_ENCRYPTION_KEY');
  });
});

describe('writing settings', () => {
  it.each(['TOKEN_ENCRYPTION_KEY', 'TOKEN_ENCRYPTION_KEY_PATH'])(
    'refuses an admin attempting to change the deployment-only %s',
    async (key) => {
      const secret = Buffer.alloc(32, 9).toString('base64');
      const res = await patchSettings({ [key]: secret }, cookie(ADMIN_TOKEN));
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain('server environment');
      expect(body).not.toContain(secret);
    },
  );

  it('refuses an anonymous write with a 401, the sign-in answer', async () => {
    const res = await patchSettings({ SCORE_THRESHOLD: 8 });
    expect(res.status).toBe(401);
    expect((await errorOf(res)).message).toBe('Sign in to continue.');
  });

  it('refuses a customer with a 403 that names the missing permission', async () => {
    const res = await patchSettings({ SCORE_THRESHOLD: 8 }, cookie(CUSTOMER_TOKEN));
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toEqual({
      message: 'You do not have permission to do this.',
      detail: 'requires settings:write',
    });
  });

  it('accepts an admin signed in through the browser cookie', async () => {
    const res = await patchSettings({ SCORE_THRESHOLD: 8 }, cookie(ADMIN_TOKEN));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { success: boolean; values: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(body.values.SCORE_THRESHOLD).toBe(8);
  });

  it('accepts the same admin session as a bearer header, which is how the CLI sends it', async () => {
    const res = await patchSettings(
      { SCORE_THRESHOLD: 6 },
      { authorization: `Bearer ${ADMIN_TOKEN}` },
    );
    expect(res.status).toBe(200);
  });

  it('ignores a bearer that is not a session', async () => {
    const res = await patchSettings({ SCORE_THRESHOLD: 8 }, { authorization: 'Bearer nope' });
    expect(res.status).toBe(401);
  });

  it('still validates the payload after the gate', async () => {
    const res = await patchSettings({ SCORE_THRESHOLD: 99 }, cookie(ADMIN_TOKEN));
    expect(res.status).toBe(400);
  });
});
