import { promises as fs } from 'fs';
import type { PublishDraftItem } from '@lib/types/publish.js';
import { log } from '@lib/utils/logger.js';

const YOUTUBE_UPLOAD_URL =
  'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart';
const YOUTUBE_THUMBNAILS_URL = 'https://www.googleapis.com/upload/youtube/v3/thumbnails/set';
const YOUTUBE_PLAYLIST_ITEMS_URL =
  'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet';

/**
 * Uploads a single prepared clip to YouTube via the multipart upload endpoint.
 * Pure HTTP client — auth token and item are injected; no config or db access.
 */
export async function uploadToYouTube(
  item: PublishDraftItem,
  accessToken: string,
  requestId?: string,
): Promise<{ videoId: string; youtubeUrl: string }> {
  const file = await fs.readFile(item.editedPath ?? item.path);
  const boundary = `video-clipper-${Date.now()}`;
  const description =
    item.isShort && !item.description.includes('#Shorts')
      ? `${item.description}\n\n#Shorts`.trim()
      : item.description;
  const scheduleMs = item.scheduledAt ? Date.parse(item.scheduledAt) : NaN;
  const hasFutureSchedule = Number.isFinite(scheduleMs) && scheduleMs > Date.now() + 60_000;

  if (item.scheduledAt && !hasFutureSchedule) {
    log.warn('uploadToYouTube', '[schedule-stale]', requestId, {
      clipArtifactId: item.clipArtifactId,
      scheduledAt: item.scheduledAt,
    });
  }
  if (hasFutureSchedule && item.privacyStatus !== 'private') {
    log.info('uploadToYouTube', '[schedule-coerce]', requestId, {
      clipArtifactId: item.clipArtifactId,
      from: item.privacyStatus,
      publishAt: item.scheduledAt,
    });
  }

  const status: Record<string, unknown> = {
    privacyStatus: hasFutureSchedule ? 'private' : item.privacyStatus,
    selfDeclaredMadeForKids: item.selfDeclaredMadeForKids,
    embeddable: item.embeddable,
    license: item.license,
    publicStatsViewable: item.publicStatsViewable,
    containsSyntheticMedia: item.containsSyntheticMedia,
  };
  if (hasFutureSchedule) {
    status.publishAt = item.scheduledAt;
  }

  const metadata = {
    snippet: {
      title: item.title,
      description,
      tags: item.tags,
      categoryId: item.categoryId,
    },
    status,
  };

  const metadataPart = Buffer.from(JSON.stringify(metadata), 'utf-8');
  const delimiter = Buffer.from(`--${boundary}\r\n`, 'utf-8');
  const closeDelimiter = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const metadataHeader = Buffer.from(
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    'utf-8',
  );
  const mediaHeader = Buffer.from(
    '\r\n--' + boundary + '\r\nContent-Type: video/mp4\r\n\r\n',
    'utf-8',
  );
  const body = Buffer.concat([
    delimiter,
    metadataHeader,
    metadataPart,
    mediaHeader,
    file,
    closeDelimiter,
  ]);

  log.info('uploadToYouTube', '[youtube-request]', requestId, {
    clipArtifactId: item.clipArtifactId,
    fileBytes: file.length,
    bodyBytes: body.length,
    privacy: item.privacyStatus,
  });

  const res = await fetch(YOUTUBE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': `multipart/related; boundary=${boundary}`,
      'content-length': String(body.length),
    },
    body,
  });

  const rawText = await res.text();
  const raw = tryParseJson(rawText) as { id?: string; error?: { message?: string } } | null;

  if (!res.ok || !raw?.id) {
    log.warn('uploadToYouTube', '[youtube-failed]', requestId, {
      clipArtifactId: item.clipArtifactId,
      status: res.status,
      error: sanitizeLogValue(raw?.error?.message || rawText),
    });
    throw new Error(
      raw?.error?.message || summarizeResponseText(rawText) || 'YouTube upload failed.',
    );
  }

  log.info('uploadToYouTube', '[youtube-response]', requestId, {
    clipArtifactId: item.clipArtifactId,
    status: res.status,
    ok: res.ok,
  });

  return {
    videoId: raw.id,
    youtubeUrl: `https://www.youtube.com/watch?v=${raw.id}`,
  };
}

export async function uploadThumbnail(
  youtubeVideoId: string,
  thumbnailPath: string,
  accessToken: string,
  requestId?: string,
): Promise<void> {
  const file = await fs.readFile(thumbnailPath);
  const ext = thumbnailPath.split('.').pop()?.toLowerCase() ?? 'jpeg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  log.info('uploadThumbnail', '[thumbnail-upload]', requestId, {
    youtubeVideoId,
    bytes: file.length,
    mime: mimeType,
  });

  const res = await fetch(
    `${YOUTUBE_THUMBNAILS_URL}?videoId=${encodeURIComponent(youtubeVideoId)}&uploadType=media`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'content-type': mimeType,
        'content-length': String(file.length),
      },
      body: file,
    },
  );

  if (!res.ok) {
    const rawText = await res.text();
    const raw = tryParseJson(rawText) as { error?: { message?: string } } | null;
    throw new Error(
      raw?.error?.message || summarizeResponseText(rawText) || 'Thumbnail upload failed.',
    );
  }
}

export async function insertIntoPlaylist(
  youtubeVideoId: string,
  playlistId: string,
  accessToken: string,
  requestId?: string,
): Promise<void> {
  log.info('insertIntoPlaylist', '[playlist-insert]', requestId, { youtubeVideoId, playlistId });

  const body = JSON.stringify({
    snippet: {
      playlistId,
      resourceId: {
        kind: 'youtube#video',
        videoId: youtubeVideoId,
      },
    },
  });

  const res = await fetch(YOUTUBE_PLAYLIST_ITEMS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const rawText = await res.text();
    const raw = tryParseJson(rawText) as { error?: { message?: string; code?: number } } | null;
    const code = raw?.error?.code;
    const message =
      raw?.error?.message || summarizeResponseText(rawText) || 'Playlist insert failed.';
    if (code === 403) {
      throw new Error(
        `${message} — reconnect your YouTube account with the youtube.force-ssl scope to enable playlist management.`,
      );
    }
    throw new Error(message);
  }
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function summarizeResponseText(text: string): string {
  return sanitizeLogValue(text).slice(0, 240);
}

function sanitizeLogValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
