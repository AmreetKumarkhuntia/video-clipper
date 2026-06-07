import { eq, asc } from 'drizzle-orm';
import { db } from '../client.js';
import { qaMessages } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { QaMessage, QaCitation } from '@lib/types/qa.js';
import { QaMessageSchema } from '@lib/types/qa.js';

function rowToMessage(row: {
  id: string;
  videoId: string;
  role: string;
  content: string;
  citations: string;
  createdAt: number;
}): QaMessage {
  const citations = JSON.parse(row.citations) as QaCitation[];
  return QaMessageSchema.parse({
    id: row.id,
    role: row.role,
    content: row.content,
    citations,
    createdAt: new Date(row.createdAt).toISOString(),
  });
}

export function findQaMessages(videoId: string): QaMessage[] {
  const done = log.dbCalled('findQaMessages', undefined, { videoId });
  const rows = db
    .select()
    .from(qaMessages)
    .where(eq(qaMessages.videoId, videoId))
    .orderBy(asc(qaMessages.createdAt))
    .all();
  done();
  return rows.map(rowToMessage);
}

export function insertQaMessage(videoId: string, msg: QaMessage): void {
  const done = log.dbCalled('insertQaMessage', undefined, { videoId, role: msg.role });
  db.insert(qaMessages)
    .values({
      id: msg.id,
      videoId,
      role: msg.role,
      content: msg.content,
      citations: JSON.stringify(msg.citations),
      createdAt: new Date(msg.createdAt).getTime(),
    })
    .run();
  done();
}

export function clearQaMessages(videoId: string): boolean {
  const done = log.dbCalled('clearQaMessages', undefined, { videoId });
  const result = db.delete(qaMessages).where(eq(qaMessages.videoId, videoId)).run();
  done();
  return result.changes > 0;
}
