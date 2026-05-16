import { db } from '../client.js';
import { channels } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { ChannelInput } from '@lib/types/db.js';

export function upsertChannel(channel: ChannelInput): void {
  const done = log.dbCalled('upsertChannel', undefined, { id: channel.id, title: channel.title });
  const ts = Date.now();
  db.insert(channels)
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
    .run();
  done({ id: channel.id });
}
