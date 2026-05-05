import { promises as fs } from 'fs';
import {
  createArtifactId,
  getPublishDraft,
  saveUploadArtifacts,
} from '@app/web/lib/services/artifacts/artifactStore.js';
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

export interface UploadDraftClipsCallbacks {
  onUploadStarted?: (item: PublishDraftItem) => void;
  onUploadFinished?: (upload: UploadArtifact) => void;
  onUploadFailed?: (upload: UploadArtifact) => void;
}

export async function uploadDraftClips(
  input: CreateUploadsRequest,
  cfg: Config,
  requestId?: string,
  callbacks?: UploadDraftClipsCallbacks,
): Promise<UploadArtifact[]> {
  const done = log.fnCalled('uploadDraftClips', { analysisId: input.analysisId }, requestId);

  const draft = await getPublishDraft(cfg.OUTPUT_DIR, input.analysisId);

  if (!draft) {
    log.warn(
      `${requestId ?? 'no-request-id'} [publish-upload] [draft] | analysisId=${input.analysisId} status=missing`,
    );
    throw new Error('Save a publish draft before uploading clips.');
  }

  log.info(
    `${requestId ?? 'no-request-id'} [publish-upload] [draft] | analysisId=${draft.analysisId} totalItems=${draft.items.length} titleLength=${draft.title.length}`,
  );

  const auth = await getAuthorizedYouTubeAuthState(requestId);
  const selectedItems = draft.items.filter((item) => {
    if (input.clipArtifactIds?.length) {
      return input.clipArtifactIds.includes(item.clipArtifactId);
    }

    return item.selected;
  });

  if (selectedItems.length === 0) {
    log.warn(
      `${requestId ?? 'no-request-id'} [publish-upload] [selection] | analysisId=${input.analysisId} selected=0 requestedClips=${input.clipArtifactIds?.length ?? 0}`,
    );
    throw new Error('Select at least one prepared clip before uploading.');
  }

  log.info(
    `${requestId ?? 'no-request-id'} [publish-upload] [selection] | analysisId=${input.analysisId} selected=${selectedItems.length} authMode=${auth.authMode} channelId=${auth.channel.channelId}`,
  );

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
  log.info(
    `${requestId ?? 'no-request-id'} [publish-upload] [persisted] | analysisId=${input.analysisId} uploaded=${uploaded} failed=${failed} savedArtifacts=${saved.length}`,
  );
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
  const done = log.fnCalled('uploadSingleClip', { clip: item.filename }, requestId);
  const createdAt = new Date().toISOString();
  const startedAt = Date.now();

  log.info(
    `${requestId ?? 'no-request-id'} [publish-upload] [clip-start] | clipArtifactId=${item.clipArtifactId} file=${item.filename} privacy=${item.privacyStatus} titleLength=${item.title.length}`,
  );

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
        log.warn(
          `${requestId ?? 'no-request-id'} [publish-upload] [thumbnail-failed] | clipArtifactId=${item.clipArtifactId} error=${msg}`,
        );
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
        log.warn(
          `${requestId ?? 'no-request-id'} [publish-upload] [playlist-insert-failed] | clipArtifactId=${item.clipArtifactId} playlistId=${item.playlistId} error=${msg}`,
        );
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
    log.info(
      `${requestId ?? 'no-request-id'} [publish-upload] [clip-success] | clipArtifactId=${item.clipArtifactId} youtubeVideoId=${uploaded.videoId} elapsedMs=${Date.now() - startedAt}`,
    );
    done({ status: 'uploaded' });
    return artifact;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(
      `${requestId ?? 'no-request-id'} [publish-upload] [clip-failed] | clipArtifactId=${item.clipArtifactId} file=${item.filename} elapsedMs=${Date.now() - startedAt} error=${sanitizeLogValue(message)}`,
    );
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
  const file = await fs.readFile(item.path);
  const boundary = `video-clipper-${Date.now()}`;
  const description =
    item.isShort && !item.description.includes('#Shorts')
      ? `${item.description}\n\n#Shorts`.trim()
      : item.description;
  const metadata = {
    snippet: {
      title: item.title,
      description,
      tags: item.tags,
      categoryId: item.categoryId,
    },
    status: {
      privacyStatus: item.privacyStatus,
      selfDeclaredMadeForKids: item.selfDeclaredMadeForKids,
      embeddable: item.embeddable,
      license: item.license,
      publicStatsViewable: item.publicStatsViewable,
      containsSyntheticMedia: item.containsSyntheticMedia,
    },
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

  log.info(
    `${requestId ?? 'no-request-id'} [publish-upload] [youtube-request] | clipArtifactId=${item.clipArtifactId} fileBytes=${file.length} bodyBytes=${body.length} privacy=${item.privacyStatus}`,
  );

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

  log.info(
    `${requestId ?? 'no-request-id'} [publish-upload] [youtube-response] | clipArtifactId=${item.clipArtifactId} status=${res.status} ok=${res.ok}`,
  );

  if (!res.ok || !raw?.id) {
    throw new Error(
      raw?.error?.message || summarizeResponseText(rawText) || 'YouTube upload failed.',
    );
  }

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

  log.info(
    `${requestId ?? 'no-request-id'} [publish-upload] [thumbnail-upload] | youtubeVideoId=${youtubeVideoId} bytes=${file.length} mime=${mimeType}`,
  );

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
  log.info(
    `${requestId ?? 'no-request-id'} [publish-upload] [playlist-insert] | youtubeVideoId=${youtubeVideoId} playlistId=${playlistId}`,
  );

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
