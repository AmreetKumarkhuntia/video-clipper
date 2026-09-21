import { eq, asc } from 'drizzle-orm';
import { getDb } from '../client.js';
import { qaMessages } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { QaMessage } from '@lib/types/qa.js';
import { QaCitationSchema, QaMessageSchema } from '@lib/types/qa.js';

function rowToMessage(row: {
  id: string;
  videoId: string;
  role: string;
  content: string;
  citations: unknown;
  createdAt: Date;
}): QaMessage {
  const citations = QaCitationSchema.array().parse(row.citations);
  return QaMessageSchema.parse({
    id: row.id,
    role: row.role,
    content: row.content,
    citations,
    createdAt: row.createdAt.toISOString(),
  });
}

export async function findQaMessages(videoId: string): Promise<QaMessage[]> {
  const done = log.dbCalled('findQaMessages', undefined, { videoId });
  const rows = await getDb()
    .select()
    .from(qaMessages)
    .where(eq(qaMessages.videoId, videoId))
    .orderBy(asc(qaMessages.createdAt));
  done();
  return rows.map(rowToMessage);
}

export async function insertQaMessage(videoId: string, msg: QaMessage): Promise<void> {
  const done = log.dbCalled('insertQaMessage', undefined, { videoId, role: msg.role });
  await getDb()
    .insert(qaMessages)
    .values({
      id: msg.id,
      videoId,
      role: msg.role,
      content: msg.content,
      citations: QaCitationSchema.array().parse(msg.citations),
      createdAt: new Date(msg.createdAt),
    })
    .returning({ id: qaMessages.id });
  done();
}

export async function clearQaMessages(videoId: string): Promise<boolean> {
  const done = log.dbCalled('clearQaMessages', undefined, { videoId });
  const rows = await getDb()
    .delete(qaMessages)
    .where(eq(qaMessages.videoId, videoId))
    .returning({ id: qaMessages.id });
  done();
  return rows.length > 0;
}
