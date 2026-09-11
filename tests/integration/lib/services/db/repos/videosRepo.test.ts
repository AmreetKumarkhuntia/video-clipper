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

const { findVideo, upsertVideo } = await import('@lib/services/db/repos/videosRepo.js');

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

afterAll(() => sqlite.close());

describe('videosRepo', () => {
  it('persists catalog fields and updates an existing video', () => {
    upsertVideo(makeVideo('vid1'));
    expect(findVideo('vid1')?.thumbnailUrl).toBe('https://i.ytimg.com/vi/vid1/hqdefault.jpg');

    upsertVideo(makeVideo('vid1', { title: 'Renamed' }));
    expect(findVideo('vid1')).toMatchObject({
      title: 'Renamed',
      thumbnailUrl: 'https://i.ytimg.com/vi/vid1/hqdefault.jpg',
    });
  });

  it('stores a missing thumbnail as null', () => {
    const video = makeVideo('vid2');
    delete video.thumbnail;
    upsertVideo(video);

    expect(findVideo('vid2')?.thumbnailUrl).toBeNull();
  });
});
