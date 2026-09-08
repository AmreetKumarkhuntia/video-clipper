import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from '../src/lib/services/db/schema.js';
import type { VideoDetails } from '../src/lib/types/youtube.js';

// ── In-memory DB setup ────────────────────────────────────────────────────────

const sqlite = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

vi.mock('../src/lib/services/db/client.js', () => ({ db: testDb }));

// ── Import repos after the mock is in place ──────────────────────────────────

const { saveLibraryVideo, removeLibraryVideo, findSavedVideoIds, listLibraryVideos } =
  await import('../src/lib/services/db/repos/libraryVideosRepo.js');
const { upsertVideo, findVideo } = await import('../src/lib/services/db/repos/videosRepo.js');

const CUSTOMER_A = 'customer-a';
const CUSTOMER_B = 'customer-b';

function makeVideo(id: string, overrides: Partial<VideoDetails> = {}): VideoDetails {
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
    ...overrides,
  };
}

beforeEach(() => {
  sqlite.exec('DELETE FROM library_videos; DELETE FROM videos;');
});

describe('videosRepo thumbnail', () => {
  it('persists the thumbnail url and survives a re-upsert', () => {
    upsertVideo(makeVideo('vid1'));
    expect(findVideo('vid1')?.thumbnailUrl).toBe('https://i.ytimg.com/vi/vid1/hqdefault.jpg');

    upsertVideo(makeVideo('vid1', { title: 'Renamed' }));
    const row = findVideo('vid1');
    expect(row?.title).toBe('Renamed');
    expect(row?.thumbnailUrl).toBe('https://i.ytimg.com/vi/vid1/hqdefault.jpg');
  });

  it('stores null when the video has no thumbnail', () => {
    const video = makeVideo('vid2');
    delete video.thumbnail;
    upsertVideo(video);
    expect(findVideo('vid2')?.thumbnailUrl).toBeNull();
  });
});

describe('libraryVideosRepo', () => {
  it('saves a video and lists it with catalog fields joined', () => {
    upsertVideo(makeVideo('vid1'));
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });

    const page = listLibraryVideos(CUSTOMER_A, 24, 0);
    expect(page.total).toBe(1);
    expect(page.videos[0]?.videoId).toBe('vid1');
    expect(page.videos[0]?.title).toBe('Video vid1');
    expect(page.videos[0]?.thumbnailUrl).toBe('https://i.ytimg.com/vi/vid1/hqdefault.jpg');
  });

  it('is idempotent — adding twice keeps one row', () => {
    upsertVideo(makeVideo('vid1'));
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });

    expect(listLibraryVideos(CUSTOMER_A, 24, 0).total).toBe(1);
  });

  it('lets two customers save the same video independently', () => {
    upsertVideo(makeVideo('vid1'));
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });
    saveLibraryVideo({ customerId: CUSTOMER_B, videoId: 'vid1' });

    expect(listLibraryVideos(CUSTOMER_A, 24, 0).total).toBe(1);
    expect(listLibraryVideos(CUSTOMER_B, 24, 0).total).toBe(1);

    removeLibraryVideo(CUSTOMER_A, 'vid1');
    expect(listLibraryVideos(CUSTOMER_A, 24, 0).total).toBe(0);
    expect(listLibraryVideos(CUSTOMER_B, 24, 0).total).toBe(1);
  });

  it('orders newest save first and pages with limit and offset', () => {
    for (const id of ['vid1', 'vid2', 'vid3']) {
      upsertVideo(makeVideo(id));
      saveLibraryVideo({ customerId: CUSTOMER_A, videoId: id });
      sqlite.exec(`UPDATE library_videos SET saved_at = saved_at + ${id.slice(-1)} * 1000`);
    }
    const first = listLibraryVideos(CUSTOMER_A, 2, 0);
    expect(first.total).toBe(3);
    expect(first.videos).toHaveLength(2);

    const second = listLibraryVideos(CUSTOMER_A, 2, 2);
    expect(second.videos).toHaveLength(1);
    const seen = [...first.videos, ...second.videos].map((v) => v.videoId);
    expect(new Set(seen).size).toBe(3);
  });

  it('reports which of a set of ids are already saved, scoped per customer', () => {
    for (const id of ['vid1', 'vid2', 'vid3']) upsertVideo(makeVideo(id));
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid1' });
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'vid3' });

    const saved = findSavedVideoIds(CUSTOMER_A, ['vid1', 'vid2', 'vid3']);
    expect(saved.sort()).toEqual(['vid1', 'vid3']);
    expect(findSavedVideoIds(CUSTOMER_B, ['vid1', 'vid2', 'vid3'])).toEqual([]);
    expect(findSavedVideoIds(CUSTOMER_A, [])).toEqual([]);
  });

  it('omits a saved id whose catalog row is missing', () => {
    saveLibraryVideo({ customerId: CUSTOMER_A, videoId: 'ghost' });
    expect(listLibraryVideos(CUSTOMER_A, 24, 0).videos).toHaveLength(0);
  });
});
