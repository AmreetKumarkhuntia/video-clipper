import { MongoClient } from 'mongodb';
import { log } from './logger.js';
import { FileCacheBackend } from './fileCacheBackend.js';
import { MongoCacheBackend } from './mongoCacheBackend.js';
import { DisabledCacheBackend } from './cacheBackend.js';
import type { CacheBackend } from './cacheBackend.js';
import type { Config } from '../types/index.js';

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
    log.info(`[cache] Using MongoDB backend (${config.MONGODB_DATABASE})`);
    const client = new MongoClient(uri);
    await client.connect();
    return new MongoCacheBackend(client, config.MONGODB_DATABASE, config.CACHE_TTL_SECONDS);
  }

  // Default: file-based backend
  return new FileCacheBackend(config.CACHE_DIR);
}
