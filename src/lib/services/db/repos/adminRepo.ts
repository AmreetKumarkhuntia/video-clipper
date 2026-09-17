import { getDb, withDbTransaction } from '../client.js';
import { chunks, videos, channels, clips } from '../schema.js';
import { log } from '@lib/utils/logger.js';

export async function clearDatabase(): Promise<void> {
  log.info('adminRepo', 'clearDatabase call');
  await withDbTransaction(async () => {
    const db = getDb();
    await db.delete(clips);
    await db.delete(chunks);
    await db.delete(videos);
    await db.delete(channels);
  });
  log.info('adminRepo', 'clearDatabase done');
}
