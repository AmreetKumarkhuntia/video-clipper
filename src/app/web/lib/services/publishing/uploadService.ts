import { promises as fs } from 'fs';
import {
  createArtifactId,
  saveUploadArtifacts,
} from '@app/web/lib/services/artifacts/artifactStore.js';
import { loadAndRefreshPublishDraft } from '@app/web/lib/services/publishing/draftService.js';
import { getAuthorizedYouTubeAuthState } from '@app/web/lib/services/youtube/uploadAuth.js';
import {
  UploadArtifactSchema,
  type CreateUploadsRequest,
  type PublishDraftItem,
  type UploadArtifact,
  type YouTubeAuthState,
} from '@app/web/types/publish.js';
import type { Config } from '@lib/types/config.js';
import { log } from '@lib/utils/logger.js';

const YOUTUBE_UPLOAD_URL =
  'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart';
const YOUTUBE_THUMBNAILS_URL = 'https://www.googleapis.com/upload/youtube/v3/thumbnails/set';
const YOUTUBE_PLAYLIST_ITEMS_URL =
  'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet';

import type { UploadDraftClipsCallbacks } from '@app/web/types/upload.js';

export type { UploadDraftClipsCallbacks };

export async function uploadDraftClips(
  input: CreateUploadsRequest,
  cfg: Config,
  requestId?: string,
  callbacks?: UploadDraftClipsCallbacks,
): Promise<UploadArtifact[]> {
  const done = log.fnCalled('uploadDraftClips', requestId, { analysisId: input.analysisId });

  const draft = await loadAndRefreshPublishDraft(input.analysisId, cfg, requestId);

  if (!draft) {
    log.warn('uploadDraftClips', '[draft] draft missing', requestId, {
      analysisId: input.analysisId,
      status: 'missing',
    });
    throw new Error('Save a publish draft before uploading clips.');
  }

  log.info('uploadDraftClips', '[draft]', requestId, {
    analysisId: draft.analysisId,
    totalItems: draft.items.length,
    titleLength: draft.title.length,
  });

  const auth = await getAuthorizedYouTubeAuthState(requestId);
  const selectedItems = draft.items.filter((item) => {
    if (input.clipArtifactIds?.length) {
      return input.clipArtifactIds.includes(item.clipArtifactId);
    }

    return item.selected;
  });

  if (selectedItems.length === 0) {
    log.warn('uploadDraftClips', '[selection] no clips selected', requestId, {
      analysisId: input.analysisId,
      selected: 0,
      requestedClips: input.clipArtifactIds?.length ?? 0,
    });
    throw new Error('Select at least one prepared clip before uploading.');
  }

  log.info('uploadDraftClips', '[selection]', requestId, {
    analysisId: input.analysisId,
    selected: selectedItems.length,
    authMode: auth.authMode,
    channelId: auth.channel.channelId,
  });

  const uploads: UploadArtifact[] = [];

  for (const item of selectedItems) {
    callbacks?.onUploadStarted?.(item);
    const upload = await uploadSingleClip(item, draft.analysisId, draft.videoId, auth, requestId);
    uploads.push(upload);

    if (upload.status === 'uploaded') {
      callbacks?.onUploadFinished?.(upload);
    } else {
      callbacks?.onUploadFailed?.(upload);
    }
  }

  const saved = await saveUploadArtifacts(uploads, cfg.OUTPUT_DIR);
  const uploaded = uploads.filter((u) => u.status === 'uploaded').length;
  const failed = uploads.length - uploaded;
  log.info('uploadDraftClips', '[persisted]', requestId, {
    analysisId: input.analysisId,
    uploaded,
    failed,
    savedArtifacts: saved.length,
  });
  done({ uploaded, total: uploads.length });
  return saved;
}

async function uploadSingleClip(
  item: PublishDraftItem,
  analysisId: string,
  videoId: string,
  auth: YouTubeAuthState,
  requestId?: string,
): Promise<UploadArtifact> {
  const done = log.fnCalled('uploadSingleClip', requestId, { clip: item.filename });
  const createdAt = new Date().toISOString();
  const startedAt = Date.now();

  log.info('uploadSingleClip', '[clip-start]', requestId, {
    clipArtifactId: item.clipArtifactId,
    file: item.filename,
    privacy: item.privacyStatus,
    titleLength: item.title.length,
  });

  try {
    const uploaded = await uploadToYouTube(item, auth.accessToken, requestId);

    // Non-fatal post-upload steps: thumbnail + playlist
    if (item.thumbnailPath) {
      await uploadThumbnail(
        uploaded.videoId,
        item.thumbnailPath,
        auth.accessToken,
        requestId,
      ).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn('uploadSingleClip', '[thumbnail-failed]', requestId, {
          clipArtifactId: item.clipArtifactId,
          error: msg,
        });
      });
    }

    if (item.playlistId) {
      await insertIntoPlaylist(
        uploaded.videoId,
        item.playlistId,
        auth.accessToken,
        requestId,
      ).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn('uploadSingleClip', '[playlist-insert-failed]', requestId, {
          clipArtifactId: item.clipArtifactId,
          playlistId: item.playlistId,
          error: msg,
        });
      });
    }
    const artifact = UploadArtifactSchema.parse({
      id: createArtifactId(`upload-${videoId}`),
      analysisId,
      videoId,
      clipArtifactId: item.clipArtifactId,
      title: item.title,
      privacyStatus: item.privacyStatus,
      status: 'uploaded',
      youtubeVideoId: uploaded.videoId,
      youtubeUrl: uploaded.youtubeUrl,
      createdAt,
      updatedAt: new Date().toISOString(),
    });
    log.info('uploadSingleClip', '[clip-success]', requestId, {
      clipArtifactId: item.clipArtifactId,
      youtubeVideoId: uploaded.videoId,
      elapsedMs: Date.now() - startedAt,
    });
    done({ status: 'uploaded' });
    return artifact;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn('uploadSingleClip', '[clip-failed]', requestId, {
      clipArtifactId: item.clipArtifactId,
      file: item.filename,
      elapsedMs: Date.now() - startedAt,
      error: sanitizeLogValue(message),
    });
    const artifact = UploadArtifactSchema.parse({
      id: createArtifactId(`upload-${videoId}`),
      analysisId,
      videoId,
      clipArtifactId: item.clipArtifactId,
      title: item.title,
      privacyStatus: item.privacyStatus,
      status: 'failed',
      error: message,
      createdAt,
      updatedAt: new Date().toISOString(),
    });
    done({ status: 'failed' });
    return artifact;
  }
}

async function uploadToYouTube(
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

async function uploadThumbnail(
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

async function insertIntoPlaylist(
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
