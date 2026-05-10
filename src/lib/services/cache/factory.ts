import { MongoClient } from 'mongodb';
import { log } from '@lib/utils/logger.js';
import { FileCacheBackend } from './backends/file.js';
import { MongoCacheBackend } from './backends/mongo.js';
import { DisabledCacheBackend } from './backends/disabled.js';
import type { CacheBackend } from '@lib/types/cache.js';
import type { Config } from '@lib/types/index.js';

/**
 * Creates the appropriate CacheBackend based on config.
 *
 * - `disabled = true`        → DisabledCacheBackend (--no-cache flag)
 * - `CACHE_BACKEND = 'file'` → FileCacheBackend (default)
 * - `CACHE_BACKEND = 'mongodb'` → MongoCacheBackend (requires MONGODB_URI)
 *
 * The caller is responsible for calling `backend.close()` when the pipeline
 * finishes so that any open connections (e.g. MongoClient) are released.
 */
export async function createCacheBackend(
  config: Pick<
    Config,
    'CACHE_BACKEND' | 'CACHE_DIR' | 'MONGODB_URI' | 'MONGODB_DATABASE' | 'CACHE_TTL_SECONDS'
  >,
  disabled: boolean,
): Promise<CacheBackend> {
  if (disabled) {
    return new DisabledCacheBackend();
  }

  if (config.CACHE_BACKEND === 'mongodb') {
    // MONGODB_URI is guaranteed to be set by the superRefine in ConfigSchema
    const uri = config.MONGODB_URI as string;
    log.info('createCacheBackend', `[cache] Using MongoDB backend (${config.MONGODB_DATABASE})`);
    const client = new MongoClient(uri);
    await client.connect();
    return new MongoCacheBackend(client, config.MONGODB_DATABASE, config.CACHE_TTL_SECONDS);
  }

  // Default: file-based backend
  return new FileCacheBackend(config.CACHE_DIR);
}
