import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearQaMessages, findQaMessages, insertQaMessage } from '@lib/services/db/index.js';
import type { QaMessage } from '@lib/types/qa.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../../support/postgres.js';
import { seedVideo } from '../postgresFixtures.js';

let database: PostgresTestDatabase;

function message(id: string, createdAt: string, content: string): QaMessage {
  return {
    id,
    role: id.startsWith('user') ? 'user' : 'assistant',
    content,
    citations: id.startsWith('assistant') ? [{ label: '[0:12]', timeSec: 12 }] : [],
    createdAt,
  };
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('qa_messages_repo');
});

beforeEach(async () => {
  await database.reset();
  await Promise.all([seedVideo(database, 'video-1'), seedVideo(database, 'video-2')]);
});

afterAll(async () => {
  await database.close();
});

describe('qaMessagesRepo', () => {
  it('round-trips JSONB citations in chronological order and isolates videos', async () => {
    await insertQaMessage('video-1', message('assistant-1', '2026-01-01T00:00:02.000Z', 'Answer'));
    await insertQaMessage('video-1', message('user-1', '2026-01-01T00:00:01.000Z', 'Question'));
    await insertQaMessage('video-2', message('user-2', '2026-01-01T00:00:03.000Z', 'Other'));

    expect(await findQaMessages('video-1')).toEqual([
      message('user-1', '2026-01-01T00:00:01.000Z', 'Question'),
      message('assistant-1', '2026-01-01T00:00:02.000Z', 'Answer'),
    ]);
    expect((await findQaMessages('video-2')).map((entry) => entry.id)).toEqual(['user-2']);

    const stored = await database.query<{ citations: unknown }>(
      'select citations from qa_messages where id = $1',
      ['assistant-1'],
    );
    expect(stored.rows[0]?.citations).toEqual([{ label: '[0:12]', timeSec: 12 }]);
  });

  it('clears only the requested conversation and reports whether rows changed', async () => {
    await insertQaMessage('video-1', message('user-1', '2026-01-01T00:00:01.000Z', 'Question'));
    await insertQaMessage('video-2', message('user-2', '2026-01-01T00:00:02.000Z', 'Other'));

    expect(await clearQaMessages('video-1')).toBe(true);
    expect(await clearQaMessages('video-1')).toBe(false);
    expect(await findQaMessages('video-1')).toEqual([]);
    expect(await findQaMessages('video-2')).toHaveLength(1);
  });
});
