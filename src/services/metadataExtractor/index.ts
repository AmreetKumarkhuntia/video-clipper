import { execa } from 'execa';
import { log } from '../../utils/logger.js';
import type { VideoMetadata } from '../../types/index.js';

const OEMBED_URL = 'https://www.youtube.com/oembed';

interface YtDlpJson {
  title: string;
  duration: number;
}

interface OEmbedResponse {
  title: string;
}

/**
 * Attempts to extract video metadata via yt-dlp --dump-json.
 * Returns null if yt-dlp is not installed or the call fails.
 */
async function extractViaYtDlp(videoId: string): Promise<VideoMetadata | null> {
  try {
    const { stdout } = await execa('yt-dlp', [
      '--dump-json',
      '--no-playlist',
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);
    const data = JSON.parse(stdout) as YtDlpJson;
    return {
      videoId,
      title: data.title,
      duration: data.duration,
    };
  } catch {
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
    `yt-dlp unavailable — duration unknown for "${videoId}". Install yt-dlp for full metadata.`
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
export async function extractMetadata(videoId: string): Promise<VideoMetadata> {
  const ytDlpResult = await extractViaYtDlp(videoId);
  if (ytDlpResult) {
    return ytDlpResult;
  }

  log.warn(`yt-dlp failed for "${videoId}", falling back to oEmbed...`);
  return extractViaOEmbed(videoId);
}
