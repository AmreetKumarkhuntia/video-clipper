import { db } from '../client.js';
import { chunks, videos, channels, clips } from '../schema.js';
import { log } from '@lib/utils/logger.js';

export function clearDatabase(): void {
  log.info('adminRepo', 'clearDatabase call');
  db.delete(clips).run();
  db.delete(chunks).run();
  db.delete(videos).run();
  db.delete(channels).run();
  log.info('adminRepo', 'clearDatabase done');
}
