import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@lib/services/db/schema.js';
import type { QaMessage } from '@lib/types/qa.js';

const sqlite: Database.Database = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

vi.mock('@lib/services/db/client.js', () => ({ db: testDb }));

const { clearQaMessages, findQaMessages, insertQaMessage } =
  await import('@lib/services/db/repos/qaMessagesRepo.js');

function message(id: string, createdAt: string, content: string): QaMessage {
  return {
    id,
    role: id.startsWith('user') ? 'user' : 'assistant',
    content,
    citations: id.startsWith('assistant') ? [{ label: '[0:12]', timeSec: 12 }] : [],
    createdAt,
  };
}

beforeEach(() => {
  sqlite.exec('DELETE FROM qa_messages;');
});

afterAll(() => sqlite.close());

describe('qaMessagesRepo', () => {
  it('round-trips citations in chronological order and isolates videos', () => {
    insertQaMessage('video-1', message('assistant-1', '2026-01-01T00:00:02.000Z', 'Answer'));
    insertQaMessage('video-1', message('user-1', '2026-01-01T00:00:01.000Z', 'Question'));
    insertQaMessage('video-2', message('user-2', '2026-01-01T00:00:03.000Z', 'Other'));

    expect(findQaMessages('video-1')).toEqual([
      message('user-1', '2026-01-01T00:00:01.000Z', 'Question'),
      message('assistant-1', '2026-01-01T00:00:02.000Z', 'Answer'),
    ]);
    expect(findQaMessages('video-2').map((entry) => entry.id)).toEqual(['user-2']);
  });

  it('clears only the requested conversation and reports whether rows changed', () => {
    insertQaMessage('video-1', message('user-1', '2026-01-01T00:00:01.000Z', 'Question'));
    insertQaMessage('video-2', message('user-2', '2026-01-01T00:00:02.000Z', 'Other'));

    expect(clearQaMessages('video-1')).toBe(true);
    expect(clearQaMessages('video-1')).toBe(false);
    expect(findQaMessages('video-1')).toEqual([]);
    expect(findQaMessages('video-2')).toHaveLength(1);
  });
});
