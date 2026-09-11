import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@lib/services/db/schema.js';
import type { VideoDetails } from '@lib/types/youtube.js';

const sqlite = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

vi.mock('@lib/services/db/client.js', () => ({ db: testDb }));

const { findSavedVideoIds, listLibraryVideos, removeLibraryVideo, saveLibraryVideo } =
  await import('@lib/services/db/repos/libraryVideosRepo.js');
const { upsertVideo } = await import('@lib/services/db/repos/videosRepo.js');

const CUSTOMER_A = 'customer-a';
const CUSTOMER_B = 'customer-b';

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

beforeEach(() => {
  sqlite.exec('DELETE FROM library_videos; DELETE FROM videos;');
});

afterAll(() => sqlite.close());

describe('libraryVideosRepo', () => {
  it('saves a video and lists its joined catalog fields', () => {
    upsertVideo(makeVideo('vid1'));
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });

    expect(listLibraryVideos(CUSTOMER_A, 24, 0)).toMatchObject({
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

  it('is idempotent when the same customer saves the same video twice', () => {
    upsertVideo(makeVideo('vid1'));
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });

    expect(listLibraryVideos(CUSTOMER_A, 24, 0).total).toBe(1);
  });

  it('isolates saved videos by customer', () => {
    upsertVideo(makeVideo('vid1'));
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });
    saveLibraryVideo({ customerId: CUSTOMER_B, videoId: 'vid1' });

    removeLibraryVideo(CUSTOMER_A, 'vid1');
    expect(listLibraryVideos(CUSTOMER_A, 24, 0).total).toBe(0);
    expect(listLibraryVideos(CUSTOMER_B, 24, 0).total).toBe(1);
  });

  it('orders saved videos newest first and pages with limit and offset', () => {
    for (const id of ['vid1', 'vid2', 'vid3']) {
      upsertVideo(makeVideo(id));
      saveLibraryVideo({ customerId: CUSTOMER_A, videoId: id });
      sqlite.exec(`UPDATE library_videos SET saved_at = saved_at + ${id.slice(-1)} * 1000`);
    }

    const first = listLibraryVideos(CUSTOMER_A, 2, 0);
    const second = listLibraryVideos(CUSTOMER_A, 2, 2);
    expect(first.total).toBe(3);
    expect(first.videos).toHaveLength(2);
    expect(second.videos).toHaveLength(1);
    expect(
      new Set([...first.videos, ...second.videos].map((video) => video.videoId)),
    ).toHaveProperty('size', 3);
  });

  it('finds saved ids for one customer and accepts an empty lookup', () => {
    for (const id of ['vid1', 'vid2', 'vid3']) upsertVideo(makeVideo(id));
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid3' });

    expect(findSavedVideoIds(CUSTOMER_A, ['vid1', 'vid2', 'vid3']).sort()).toEqual([
      'vid1',
      'vid3',
    ]);
    expect(findSavedVideoIds(CUSTOMER_B, ['vid1', 'vid2', 'vid3'])).toEqual([]);
    expect(findSavedVideoIds(CUSTOMER_A, [])).toEqual([]);
  });

  it('omits a saved id whose catalog row is missing', () => {
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'ghost' });
    expect(listLibraryVideos(CUSTOMER_A, 24, 0).videos).toEqual([]);
  });
});
