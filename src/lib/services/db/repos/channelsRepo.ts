import { eq } from 'drizzle-orm';
import { getDb } from '../client.js';
import { channels } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { ChannelInput, ChannelRecord } from '@lib/types/db.js';

function rowToRecord(row: typeof channels.$inferSelect): ChannelRecord {
  return {
    ...row,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function upsertChannel(channel: ChannelInput): Promise<void> {
  const done = log.dbCalled('upsertChannel', undefined, { id: channel.id, title: channel.title });
  const ts = new Date();
  await getDb()
    .insert(channels)
    .values({
      id: channel.id,
      title: channel.title,
      description: channel.description ?? null,
      handle: channel.handle ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: channels.id,
      set: {
        title: channel.title,
        description: channel.description ?? null,
        handle: channel.handle ?? null,
        updatedAt: ts,
      },
    })
    .returning({ id: channels.id });
  done({ id: channel.id });
}

/** Reads a channel's stored identity. Lets the app show the linked channel without an API call. */
export async function findChannel(channelId: string): Promise<ChannelRecord | null> {
  const done = log.dbCalled('findChannel', undefined, { channelId });
  const [row] = await getDb().select().from(channels).where(eq(channels.id, channelId)).limit(1);
  done({ found: row !== undefined });
  return row ? rowToRecord(row) : null;
}
