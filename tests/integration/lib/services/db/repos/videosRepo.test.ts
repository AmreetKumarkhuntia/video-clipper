import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clearTranscript,
  findTranscriptLines,
  findVideo,
  saveTranscript,
  upsertVideo,
} from '@lib/services/db/index.js';
import type { VideoDetails } from '@lib/types/youtube.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../../support/postgres.js';
import { seedChannel } from '../postgresFixtures.js';

let database: PostgresTestDatabase;

function makeVideo(id: string, overrides: Partial<VideoDetails> = {}): VideoDetails {
  return {
    id,
    channelId: 'UC_channel',
    channelTitle: 'Test Channel',
    title: `Video ${id}`,
    description: '',
    publishedAt: '2026-01-01T00:00:00Z',
    durationSec: 120.5,
    tags: ['typescript', 'video'],
    thumbnail: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
    ...overrides,
  };
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('videos_repo');
});

beforeEach(async () => {
  await database.reset();
  await seedChannel(database);
});

afterAll(async () => {
  await database.close();
});

describe('videosRepo', () => {
  it('round-trips native JSONB, timestamptz, and double precision through legacy contracts', async () => {
    await upsertVideo(makeVideo('vid1'));

    const stored = await database.query<{
      duration_sec: number;
      published_at: Date;
      tags: unknown;
    }>('select duration_sec, published_at, tags from videos where id = $1', ['vid1']);
    expect(stored.rows[0]).toMatchObject({
      duration_sec: 120.5,
      tags: ['typescript', 'video'],
    });
    expect(stored.rows[0]?.published_at).toBeInstanceOf(Date);

    expect(await findVideo('vid1')).toMatchObject({
      durationSec: 120.5,
      publishedAt: '2026-01-01T00:00:00.000Z',
      tags: '["typescript","video"]',
      thumbnailUrl: 'https://i.ytimg.com/vi/vid1/hqdefault.jpg',
    });

    await upsertVideo(makeVideo('vid1', { title: 'Renamed' }));
    expect(await findVideo('vid1')).toMatchObject({ title: 'Renamed' });
  });

  it('stores a missing thumbnail as null', async () => {
    const video = makeVideo('vid2');
    delete video.thumbnail;
    await upsertVideo(video);

    expect((await findVideo('vid2'))?.thumbnailUrl).toBeNull();
  });

  it('round-trips transcript JSONB and fetched time as the existing API shape', async () => {
    await upsertVideo(makeVideo('vid3'));
    const lines = [{ start: 1.25, duration: 2.5, text: 'PostgreSQL transcript' }];

    await saveTranscript('vid3', lines, '2026-02-03T04:05:06.789Z');

    expect(await findTranscriptLines('vid3')).toEqual({
      lines,
      fetchedAt: '2026-02-03T04:05:06.789Z',
    });
    const stored = await database.query<{ transcript_lines: unknown; transcript_fetched_at: Date }>(
      'select transcript_lines, transcript_fetched_at from videos where id = $1',
      ['vid3'],
    );
    expect(stored.rows[0]?.transcript_lines).toEqual(lines);
    expect(stored.rows[0]?.transcript_fetched_at).toBeInstanceOf(Date);

    expect(await clearTranscript('vid3')).toBe(true);
    expect(await findTranscriptLines('vid3')).toBeNull();
  });
});
