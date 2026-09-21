import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@app/api/app.js';
import { SESSION_COOKIE_NAME } from '@lib/types/api.js';
import {
  createCustomer,
  findVideo,
  insertSession,
  removeLibraryVideo,
  saveLibraryVideo,
  upsertChannel,
  upsertVideo,
} from '@lib/services/db/index.js';
import { hashSessionToken } from '@lib/utils/sessionToken.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../support/postgres.js';

const app = createApp();
const SESSION_TOKEN = 'videos-route-session';
const OTHER_SESSION_TOKEN = 'other-videos-route-session';
let customerId: string;
let otherCustomerId: string;
let database: PostgresTestDatabase;

function signedIn(token: string = SESSION_TOKEN): RequestInit {
  return { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } };
}

async function seedVideo(): Promise<void> {
  await upsertVideo({
    id: 'vid-1',
    channelId: 'UCtest_channel',
    title: 'First upload',
    description: '',
    channelTitle: 'Test Channel',
    publishedAt: '2026-01-01T00:00:00Z',
    durationSec: 120,
    tags: [],
  });
  await saveLibraryVideo({ customerId, videoId: 'vid-1' });
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('videos_route');
  await upsertChannel({ id: 'UCtest_channel', title: 'Test Channel' });
  const customer = await createCustomer({ email: 'owner@example.com' });
  customerId = customer.id;
  await insertSession(hashSessionToken(SESSION_TOKEN), customer.id, Date.now() + 60_000);

  const otherCustomer = await createCustomer({ email: 'other@example.com' });
  otherCustomerId = otherCustomer.id;
  await insertSession(hashSessionToken(OTHER_SESSION_TOKEN), otherCustomer.id, Date.now() + 60_000);
});

beforeEach(async () => {
  await removeLibraryVideo(customerId, 'vid-1');
  await removeLibraryVideo(otherCustomerId, 'vid-1');
});

afterAll(async () => database.close());

describe('video library routes', () => {
  it('returns an empty first page before anything is saved', async () => {
    const response = await app.request('/api/videos', signedIn());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ videos: [], total: 0, limit: 24, offset: 0 });
  });

  it('rejects a paging limit above the cap', async () => {
    expect((await app.request('/api/videos?limit=5000', signedIn())).status).toBe(400);
  });

  it('lists a saved video joined to its catalog row', async () => {
    await seedVideo();
    const response = await app.request('/api/videos', signedIn());
    const body = (await response.json()) as {
      videos: Array<{ videoId: string }>;
      total: number;
    };

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.videos[0]?.videoId).toBe('vid-1');
  });

  it('removes a saved video without deleting its catalog record', async () => {
    await seedVideo();
    const response = await app.request('/api/videos/vid-1', {
      method: 'DELETE',
      ...signedIn(),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ videoId: 'vid-1', saved: false });
    expect(await findVideo('vid-1')).not.toBeNull();

    const list = await app.request('/api/videos', signedIn());
    expect(await list.json()).toMatchObject({ total: 0 });
  });

  it('cannot list or remove a video saved by another customer', async () => {
    await seedVideo();

    const otherList = await app.request('/api/videos', signedIn(OTHER_SESSION_TOKEN));
    expect(await otherList.json()).toMatchObject({ videos: [], total: 0 });

    const otherDelete = await app.request('/api/videos/vid-1', {
      method: 'DELETE',
      ...signedIn(OTHER_SESSION_TOKEN),
    });
    expect(otherDelete.status).toBe(200);

    const ownerList = await app.request('/api/videos', signedIn());
    expect(await ownerList.json()).toMatchObject({ total: 1 });
  });
});
