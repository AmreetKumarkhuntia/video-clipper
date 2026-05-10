import { parseUrl } from '@lib/services/video/source/youtube/parser.js';
import { extractMetadata } from '@lib/services/video/source/youtube/metadata.js';
import type { YtDlpCookies } from '@lib/services/video/source/youtube/metadata.js';
import { log } from '@lib/utils/logger.js';
import { formatSeconds } from '@lib/utils/format.js';
import type { VideoResolverResult } from '@lib/types/index.js';

export async function resolveVideo(
  rawUrl: string,
  maxDurationSec: number | undefined,
  cookies: YtDlpCookies,
): Promise<VideoResolverResult> {
  let videoId: string;
  try {
    videoId = parseUrl(rawUrl);
  } catch {
    throw new Error(`Invalid YouTube URL: ${rawUrl}`);
  }

  log.info('resolveVideo', `Fetching metadata for ${videoId}...`);
  const metadata = await extractMetadata(videoId, cookies);
  log.info(
    'resolveVideo',
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
