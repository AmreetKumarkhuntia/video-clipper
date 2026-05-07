import { createHash } from 'node:crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { log } from '@lib/utils/logger.js';

import { CachedMetadataSchema } from '@app/web/types/publish.js';
import type { CachedMetadata } from '@app/web/types/publish.js';

function cacheKey(systemPrompt: string, prompt: string): string {
  return createHash('sha256').update(`${systemPrompt}\n---\n${prompt}`).digest('hex');
}

function cachePath(cacheDir: string, key: string): string {
  return path.join(cacheDir, 'publish-metadata', `${key}.json`);
}

export async function readMetadataCache(
  cacheDir: string,
  systemPrompt: string,
  prompt: string,
): Promise<CachedMetadata | null> {
  const filePath = cachePath(cacheDir, cacheKey(systemPrompt, prompt));
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = CachedMetadataSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      log.warn(`[publish-metadata-cache] corrupt entry at ${filePath} — ignoring`);
      return null;
    }
    return parsed.data;
  } catch {
    // Cache miss — silent
    return null;
  }
}

export async function writeMetadataCache(
  cacheDir: string,
  systemPrompt: string,
  prompt: string,
  metadata: CachedMetadata,
): Promise<void> {
  const filePath = cachePath(cacheDir, cacheKey(systemPrompt, prompt));
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2), 'utf-8');
  } catch (err) {
    log.warn(
      `[publish-metadata-cache] failed to write ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
