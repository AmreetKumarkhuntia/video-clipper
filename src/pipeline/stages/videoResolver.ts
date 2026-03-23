import { parseUrl } from '../../services/urlParser/index.js';
import { extractMetadata } from '../../services/metadataExtractor/index.js';
import { log } from '../../utils/logger.js';
import { formatSeconds } from '../../utils/format.js';
import type { VideoResolverResult } from '../../types/index.js';

/**
 * Stage 1 — Video Resolver
 *
 * Parses a raw YouTube URL into a validated video ID, fetches metadata
 * (title + duration), and enforces the optional --max-duration guard.
 *
 * @throws {Error} on invalid URL, metadata fetch failure, or exceeded duration
 */
export async function resolveVideo(
  rawUrl: string,
  maxDurationSec?: number,
): Promise<VideoResolverResult> {
  let videoId: string;
  try {
    videoId = parseUrl(rawUrl);
  } catch {
    throw new Error(`Invalid YouTube URL: ${rawUrl}`);
  }

  log.info(`Fetching metadata for ${videoId}...`);
  const metadata = await extractMetadata(videoId);
  log.info(
    `Video: "${metadata.title}" (${metadata.duration > 0 ? formatSeconds(metadata.duration) : 'duration unknown'})`,
  );

  if (maxDurationSec !== undefined && metadata.duration > 0) {
    if (metadata.duration > maxDurationSec) {
      throw new Error(
        `Video duration exceeds --max-duration limit. ` +
          `(${formatSeconds(metadata.duration)} > ${formatSeconds(maxDurationSec)})`,
      );
    }
  }

  return { videoId, metadata };
}
