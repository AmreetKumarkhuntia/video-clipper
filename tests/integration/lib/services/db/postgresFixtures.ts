import type { PostgresTestDatabase } from '../../../../support/postgres.js';

const FIXTURE_TIME = new Date('2026-01-01T00:00:00.000Z');

export async function seedChannel(
  database: PostgresTestDatabase,
  channelId = 'UC_channel',
): Promise<void> {
  await database.query(
    `insert into channels (id, title, created_at, updated_at)
     values ($1, $2, $3, $3)
     on conflict (id) do nothing`,
    [channelId, `Channel ${channelId}`, FIXTURE_TIME],
  );
}

export async function seedVideo(
  database: PostgresTestDatabase,
  videoId: string,
  channelId = 'UC_channel',
): Promise<void> {
  await seedChannel(database, channelId);
  await database.query(
    `insert into videos
       (id, channel_id, title, description, channel_title, published_at, duration_sec, tags,
        created_at, updated_at)
     values ($1, $2, $3, '', $4, $5, 120, '[]'::jsonb, $5, $5)
     on conflict (id) do nothing`,
    [videoId, channelId, `Video ${videoId}`, `Channel ${channelId}`, FIXTURE_TIME],
  );
}

export async function seedCustomer(
  database: PostgresTestDatabase,
  customerId: string,
): Promise<void> {
  await database.query(
    `insert into customers (id, role_id, created_at, updated_at)
     values ($1, 'customer', $2, $2)
     on conflict (id) do nothing`,
    [customerId, FIXTURE_TIME],
  );
}

export async function seedAnalysis(
  database: PostgresTestDatabase,
  analysisId: string,
  videoId: string,
): Promise<void> {
  await seedVideo(database, videoId);
  await database.query(
    `insert into analyses
       (id, video_id, title, duration_sec, options_hash, created_at, updated_at)
     values ($1, $2, $3, 120, '{}', $4, $4)
     on conflict (id) do nothing`,
    [analysisId, videoId, `Analysis ${analysisId}`, FIXTURE_TIME],
  );
}

export async function seedSegmentation(
  database: PostgresTestDatabase,
  segmentationId: string,
  videoId: string,
): Promise<void> {
  await seedVideo(database, videoId);
  await database.query(
    `insert into segmentations
       (id, video_id, rank, start_sec, end_sec, score, reason, source, options_hash,
        completed, created_at, updated_at)
     values ($1, $2, 1, 10, 40, 9, 'Fixture segment', 'transcript', '{}', true, $3, $3)
     on conflict (id) do nothing`,
    [segmentationId, videoId, FIXTURE_TIME],
  );
}
