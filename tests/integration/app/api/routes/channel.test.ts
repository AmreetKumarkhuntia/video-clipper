import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '@app/api/app.js';
import { SESSION_COOKIE_NAME } from '@lib/types/api.js';
import {
  createCustomer,
  initDb,
  insertSession,
  linkIdentity,
  runMigrations,
  upsertChannel,
} from '@lib/services/db/index.js';
import { hashSessionToken } from '@lib/utils/sessionToken.js';

const app = createApp();
const LINKED_TOKEN = 'linked-channel-session';
const UNLINKED_TOKEN = 'unlinked-channel-session';
let tempDirectory: string;

function signedIn(token: string): RequestInit {
  return { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } };
}

async function errorMessageOf(response: Response): Promise<string> {
  const body = (await response.json()) as { error: { message: string } };
  return body.error.message;
}

beforeAll(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-channel-route-'));
  initDb(path.join(tempDirectory, 'library.sqlite'));
  runMigrations();

  upsertChannel({ id: 'UCtest_channel', title: 'Test Channel' });
  const linked = createCustomer({ email: 'linked@example.com' });
  linkIdentity({
    customerId: linked.id,
    provider: 'google',
    providerAccountId: 'linked-sub',
    channelId: 'UCtest_channel',
  });
  insertSession(hashSessionToken(LINKED_TOKEN), linked.id, Date.now() + 60_000);

  const unlinked = createCustomer({ email: 'unlinked@example.com' });
  insertSession(hashSessionToken(UNLINKED_TOKEN), unlinked.id, Date.now() + 60_000);
});

afterAll(() => {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('channel routes', () => {
  it('returns the channel linked to the signed-in customer', async () => {
    const response = await app.request('/api/channel', signedIn(LINKED_TOKEN));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      channelId: 'UCtest_channel',
      title: 'Test Channel',
    });
  });

  it.each(['/api/channel', '/api/channel/videos'])(
    'returns a conflict for an account with no linked channel at %s',
    async (route) => {
      const response = await app.request(route, signedIn(UNLINKED_TOKEN));
      expect(response.status).toBe(409);
      expect(await errorMessageOf(response)).toBe('No YouTube channel is linked to this account.');
    },
  );
});
