import { promises as fs } from 'fs';
import path from 'path';
import { log } from './logger.js';
import { computeVideoCacheKey } from './fileCacheBackend.js';
import type {
  VideoCacheManifest,
  ClearVideoAnalysisResult,
  ClearVideoTranscriptResult,
} from '@lib/types/cache.js';

function manifestPath(cacheDir: string, videoId: string): string {
  return path.join(cacheDir, 'manifests', `${computeVideoCacheKey(videoId)}.json`);
}

async function readManifest(filePath: string): Promise<VideoCacheManifest> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      chunkHashes: Array.isArray(parsed?.chunkHashes) ? parsed.chunkHashes : [],
      segmentHashes: Array.isArray(parsed?.segmentHashes) ? parsed.segmentHashes : [],
    };
  } catch {
    return { chunkHashes: [], segmentHashes: [] };
  }
}

async function writeManifest(filePath: string, manifest: VideoCacheManifest): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(manifest, null, 2), 'utf-8');
}

export async function appendChunkHash(
  cacheDir: string,
  videoId: string,
  hash: string,
): Promise<void> {
  try {
    const filePath = manifestPath(cacheDir, videoId);
    const manifest = await readManifest(filePath);
    if (!manifest.chunkHashes.includes(hash)) {
      manifest.chunkHashes.push(hash);
      await writeManifest(filePath, manifest);
    }
  } catch (err) {
    log.warn(
      `[manifest] Failed to append chunk hash: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function appendSegmentHash(
  cacheDir: string,
  videoId: string,
  hash: string,
): Promise<void> {
  try {
    const filePath = manifestPath(cacheDir, videoId);
    const manifest = await readManifest(filePath);
    if (!manifest.segmentHashes.includes(hash)) {
      manifest.segmentHashes.push(hash);
      await writeManifest(filePath, manifest);
    }
  } catch (err) {
    log.warn(
      `[manifest] Failed to append segment hash: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function clearVideoAnalysisManifest(
  cacheDir: string,
  videoId: string,
): Promise<ClearVideoAnalysisResult> {
  const filePath = manifestPath(cacheDir, videoId);
  let manifestExisted = false;
  let chunksDeleted = 0;
  let segmentsDeleted = 0;

  let manifest: VideoCacheManifest;
  try {
    await fs.access(filePath);
    manifestExisted = true;
    manifest = await readManifest(filePath);
  } catch {
    return { manifestExisted, chunksDeleted, segmentsDeleted };
  }

  for (const hash of manifest.chunkHashes) {
    try {
      await fs.unlink(path.join(cacheDir, 'chunks', `${hash}.json`));
      chunksDeleted += 1;
    } catch {
      // already gone
    }
  }
  for (const hash of manifest.segmentHashes) {
    try {
      await fs.unlink(path.join(cacheDir, 'segments', `${hash}.json`));
      segmentsDeleted += 1;
    } catch {
      // already gone
    }
  }

  try {
    await fs.unlink(filePath);
  } catch {
    // best-effort
  }

  return { manifestExisted, chunksDeleted, segmentsDeleted };
}

export async function clearVideoTranscriptCache(
  cacheDir: string,
  videoId: string,
): Promise<ClearVideoTranscriptResult> {
  const filePath = path.join(cacheDir, 'transcript', `${computeVideoCacheKey(videoId)}.json`);
  try {
    await fs.unlink(filePath);
    return { deleted: true };
  } catch {
    return { deleted: false };
  }
}
