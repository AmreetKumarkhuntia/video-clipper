import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  findSavedVideoIds,
  listLibraryVideos,
  removeLibraryVideo,
  saveLibraryVideo,
  upsertVideo,
} from '@lib/services/db/index.js';
import type { VideoDetails } from '@lib/types/youtube.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../../support/postgres.js';
import { seedChannel, seedCustomer } from '../postgresFixtures.js';

const CUSTOMER_A = 'customer-a';
const CUSTOMER_B = 'customer-b';
let database: PostgresTestDatabase;

function makeVideo(id: string): VideoDetails {
  return {
    id,
    channelId: 'UC_channel',
    channelTitle: 'Test Channel',
    title: `Video ${id}`,
    description: '',
    publishedAt: '2026-01-01T00:00:00Z',
    durationSec: 120,
    tags: [],
    thumbnail: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
  };
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('library_videos_repo');
});

beforeEach(async () => {
  await database.reset();
  await seedChannel(database);
  await Promise.all([seedCustomer(database, CUSTOMER_A), seedCustomer(database, CUSTOMER_B)]);
});

afterAll(async () => {
  await database.close();
});

describe('libraryVideosRepo', () => {
  it('saves a video and lists its joined catalog fields', async () => {
    await upsertVideo(makeVideo('vid1'));
    await saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });

    expect(await listLibraryVideos(CUSTOMER_A, 24, 0)).toMatchObject({
      total: 1,
      videos: [
        {
          videoId: 'vid1',
          title: 'Video vid1',
          thumbnailUrl: 'https://i.ytimg.com/vi/vid1/hqdefault.jpg',
        },
      ],
    });
  });

  it('is idempotent when the same customer saves the same video twice', async () => {
    await upsertVideo(makeVideo('vid1'));
    await saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });
    await saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });

    expect((await listLibraryVideos(CUSTOMER_A, 24, 0)).total).toBe(1);
  });

  it('isolates saved videos by customer', async () => {
    await upsertVideo(makeVideo('vid1'));
    await saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });
    await saveLibraryVideo({ customerId: CUSTOMER_B, videoId: 'vid1' });

    await removeLibraryVideo(CUSTOMER_A, 'vid1');
    expect((await listLibraryVideos(CUSTOMER_A, 24, 0)).total).toBe(0);
    expect((await listLibraryVideos(CUSTOMER_B, 24, 0)).total).toBe(1);
  });

  it('orders saved videos newest first and pages with limit and offset', async () => {
    for (const [index, id] of ['vid1', 'vid2', 'vid3'].entries()) {
      await upsertVideo(makeVideo(id));
      await saveLibraryVideo({ customerId: CUSTOMER_A, videoId: id });
      await database.query(
        'update library_videos set saved_at = $1 where customer_id = $2 and video_id = $3',
        [new Date(Date.UTC(2026, 0, index + 1)), CUSTOMER_A, id],
      );
    }

    const first = await listLibraryVideos(CUSTOMER_A, 2, 0);
    const second = await listLibraryVideos(CUSTOMER_A, 2, 2);
    expect(first.total).toBe(3);
    expect(first.videos.map((video) => video.videoId)).toEqual(['vid3', 'vid2']);
    expect(second.videos.map((video) => video.videoId)).toEqual(['vid1']);
  });

  it('finds saved ids for one customer and accepts an empty lookup', async () => {
    for (const id of ['vid1', 'vid2', 'vid3']) await upsertVideo(makeVideo(id));
    await saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });
    await saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid3' });

    expect((await findSavedVideoIds(CUSTOMER_A, ['vid1', 'vid2', 'vid3'])).sort()).toEqual([
      'vid1',
      'vid3',
    ]);
    expect(await findSavedVideoIds(CUSTOMER_B, ['vid1', 'vid2', 'vid3'])).toEqual([]);
    expect(await findSavedVideoIds(CUSTOMER_A, [])).toEqual([]);
  });

  it('enforces parent keys and cascades library rows with videos and customers', async () => {
    await expect(
      saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'missing-video' }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });

    await upsertVideo(makeVideo('vid1'));
    await saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });
    await database.query('delete from videos where id = $1', ['vid1']);
    expect((await listLibraryVideos(CUSTOMER_A, 24, 0)).total).toBe(0);

    await upsertVideo(makeVideo('vid2'));
    await saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid2' });
    await database.query('delete from customers where id = $1', [CUSTOMER_A]);
    const remaining = await database.query<{ count: number }>(
      'select count(*)::int as count from library_videos where customer_id = $1',
      [CUSTOMER_A],
    );
    expect(remaining.rows[0]?.count).toBe(0);
  });
});
