import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '@app/api/app.js';
import { SESSION_COOKIE_NAME } from '@lib/types/api.js';
import {
  createCustomer,
  insertSession,
  linkIdentity,
  upsertChannel,
} from '@lib/services/db/index.js';
import { hashSessionToken } from '@lib/utils/sessionToken.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../support/postgres.js';

const app = createApp();
const LINKED_TOKEN = 'linked-channel-session';
const UNLINKED_TOKEN = 'unlinked-channel-session';
let database: PostgresTestDatabase;

function signedIn(token: string): RequestInit {
  return { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } };
}

async function errorMessageOf(response: Response): Promise<string> {
  const body = (await response.json()) as { error: { message: string } };
  return body.error.message;
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('channel_route');
  await upsertChannel({ id: 'UCtest_channel', title: 'Test Channel' });
  const linked = await createCustomer({ email: 'linked@example.com' });
  await linkIdentity({
    customerId: linked.id,
    provider: 'google',
    providerAccountId: 'linked-sub',
    channelId: 'UCtest_channel',
  });
  await insertSession(hashSessionToken(LINKED_TOKEN), linked.id, Date.now() + 60_000);

  const unlinked = await createCustomer({ email: 'unlinked@example.com' });
  await insertSession(hashSessionToken(UNLINKED_TOKEN), unlinked.id, Date.now() + 60_000);
});

afterAll(async () => database.close());

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
