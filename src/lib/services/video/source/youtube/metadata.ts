import { execa } from 'execa';
import { log } from '@lib/utils/logger.js';
import { retryAsync } from '@lib/utils/retryAsync.js';
import type { VideoMetadata } from '@lib/types/video.js';
import type { YtDlpCookies } from '@lib/types/downloader.js';

export type { YtDlpCookies } from '@lib/types/downloader.js';

const OEMBED_URL = 'https://www.youtube.com/oembed';

interface YtDlpJson {
  title: string;
  duration: number;
}

interface OEmbedResponse {
  title: string;
}

async function extractViaYtDlp(
  videoId: string,
  cookies: YtDlpCookies,
): Promise<VideoMetadata | null> {
  try {
    const args = ['--dump-json', '--no-playlist', `https://www.youtube.com/watch?v=${videoId}`];

    if (cookies.cookiesFromBrowser) {
      args.unshift('--cookies-from-browser', cookies.cookiesFromBrowser);
    } else if (cookies.cookiesFile) {
      args.unshift('--cookies', cookies.cookiesFile);
    }

    const { stdout } = await retryAsync(
      () => execa('yt-dlp', args),
      cookies.retryCount ?? 0,
      2000,
      `yt-dlp:metadata:${videoId}`,
    );
    const data = JSON.parse(stdout) as YtDlpJson;
    return {
      videoId,
      title: data.title,
      duration: data.duration,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`yt-dlp failed for "${videoId}": ${message}`);
    return null;
  }
}

/**
 * Falls back to YouTube oEmbed for the title (no API key needed).
 * Duration is unavailable via oEmbed, so it returns 0 with a warning.
 */
async function extractViaOEmbed(videoId: string): Promise<VideoMetadata> {
  const url = `${OEMBED_URL}?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`oEmbed request failed for "${videoId}": HTTP ${res.status}`);
  }
  const data = (await res.json()) as OEmbedResponse;
  log.warn(
    `yt-dlp unavailable — duration unknown for "${videoId}". Install yt-dlp for full metadata.`,
  );
  return {
    videoId,
    title: data.title,
    duration: 0,
  };
}

/**
 * Extracts video metadata (title, duration) for a given YouTube video ID.
 *
 * Strategy:
 * 1. Try yt-dlp --dump-json (full metadata, requires yt-dlp installed)
 * 2. Fall back to YouTube oEmbed API (title only, duration = 0)
 *
 * @throws {Error} if both strategies fail
 */
export async function extractMetadata(
  videoId: string,
  cookies: YtDlpCookies = {},
): Promise<VideoMetadata> {
  const ytDlpResult = await extractViaYtDlp(videoId, cookies);
  if (ytDlpResult) {
    return ytDlpResult;
  }

  log.warn(`yt-dlp failed for "${videoId}", falling back to oEmbed...`);
  return extractViaOEmbed(videoId);
}
