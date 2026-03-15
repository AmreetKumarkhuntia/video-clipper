const VIDEO_ID_LENGTH = 11;

/**
 * Parses a YouTube URL and returns the 11-character video ID.
 * Supports:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube.com/shorts/VIDEO_ID
 *
 * @throws {Error} if the URL is not a valid YouTube URL or the video ID is not 11 characters
 */
export function parseUrl(url: string): string {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: "${url}"`);
  }

  const { hostname, pathname, searchParams } = parsed;
  const host = hostname.replace(/^www\./, '');

  let videoId: string | null = null;

  if (host === 'youtube.com') {
    if (pathname === '/watch') {
      videoId = searchParams.get('v');
    } else if (pathname.startsWith('/embed/')) {
      videoId = pathname.split('/embed/')[1]?.split('/')[0] ?? null;
    } else if (pathname.startsWith('/shorts/')) {
      videoId = pathname.split('/shorts/')[1]?.split('/')[0] ?? null;
    }
  } else if (host === 'youtu.be') {
    videoId = pathname.slice(1).split('/')[0] ?? null;
  }

  if (!videoId) {
    throw new Error(`Could not extract video ID from URL: "${url}"`);
  }

  // Strip any extra query params that may have been part of the path segment
  videoId = videoId.split('?')[0];

  if (videoId.length !== VIDEO_ID_LENGTH) {
    throw new Error(
      `Invalid video ID "${videoId}": expected ${VIDEO_ID_LENGTH} characters, got ${videoId.length}`
    );
  }

  return videoId;
}
