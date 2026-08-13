import {
  getAnalysisFromDb,
  listClipsByAnalysisId,
  getPublishDraftByAnalysisId,
  upsertPublishDraft,
  upsertUploadArtifact,
} from '@lib/services/db/index.js';
import {
  getAuthorizedYouTubeAuthState,
  uploadToYouTube,
  uploadThumbnail,
  insertIntoPlaylist,
} from '@lib/services/publish/index.js';
import {
  PublishDraftSchema,
  UploadArtifactSchema,
  type CreateUploadsRequest,
  type PublishDraft,
  type PublishDraftItem,
  type SavePublishDraftRequest,
  type UploadArtifact,
  type UploadDraftClipsCallbacks,
  type YouTubeAuthState,
  type YouTubeOAuthClientConfig,
} from '@lib/types/publish.js';
import type { ClipArtifact, ClipPlan } from '@lib/types/analysis.js';
import type { Config } from '@lib/types/config.js';
import { createArtifactId } from '@lib/utils/ids.js';
import { log } from '@lib/utils/logger.js';
import { sanitizeLogValue } from '@lib/utils/format.js';

export async function buildPublishDraft(
  analysisId: string,
  cfg: Config,
  requestId?: string,
): Promise<PublishDraft | null> {
  const done = log.fnCalled('buildPublishDraft', requestId, { analysisId });

  const analysis = getAnalysisFromDb(analysisId);
  const clips = listClipsByAnalysisId(analysisId);

  if (!analysis || clips.length === 0) {
    done({ clips: 0 });
    return null;
  }

  const createdAt = new Date().toISOString();
  const draft = PublishDraftSchema.parse({
    id: createArtifactId(`publish-${analysis.videoId}`),
    analysisId,
    videoId: analysis.videoId,
    title: analysis.title,
    createdAt,
    updatedAt: createdAt,
    items: clips.map((clip) => buildDraftItem(clip, analysis, cfg)),
  });
  done({ clips: clips.length });
  return draft;
}

export async function loadAndRefreshPublishDraft(
  analysisId: string,
  cfg: Config,
  requestId?: string,
): Promise<PublishDraft | null> {
  const existingDraft = getPublishDraftByAnalysisId(analysisId);
  const freshDraft = await buildPublishDraft(analysisId, cfg, requestId);

  if (!freshDraft) return existingDraft;
  if (!existingDraft) return freshDraft;

  const existingById = new Map(existingDraft.items.map((item) => [item.clipArtifactId, item]));
  return PublishDraftSchema.parse({
    ...existingDraft,
    items: freshDraft.items.map((freshItem) => {
      const saved = existingById.get(freshItem.clipArtifactId);
      if (!saved) return freshItem;
      return {
        ...saved,
        path: freshItem.path,
        editedPath: freshItem.editedPath,
        isRenderRequired: freshItem.isRenderRequired,
      };
    }),
    updatedAt: new Date().toISOString(),
  });
}

export async function savePublishDraftFromRequest(
  input: SavePublishDraftRequest,
  cfg: Config,
  requestId?: string,
): Promise<PublishDraft> {
  const done = log.fnCalled('savePublishDraft', requestId, { analysisId: input.analysisId });

  const existing = getPublishDraftByAnalysisId(input.analysisId);
  const fresh = await buildPublishDraft(input.analysisId, cfg, requestId);
  const createdAt = existing?.createdAt ?? fresh?.createdAt ?? new Date().toISOString();
  const freshById = new Map((fresh?.items ?? []).map((i) => [i.clipArtifactId, i]));

  const items = input.items.map((item) => {
    const f = freshById.get(item.clipArtifactId);
    if (!f) return item;
    return {
      ...item,
      path: f.path,
      editedPath: f.editedPath,
      isRenderRequired: f.isRenderRequired,
    };
  });

  const saved = PublishDraftSchema.parse({
    id: existing?.id ?? fresh?.id ?? createArtifactId(`publish-${input.videoId}`),
    analysisId: input.analysisId,
    videoId: input.videoId,
    title: input.title,
    createdAt,
    updatedAt: new Date().toISOString(),
    items,
  });
  upsertPublishDraft(saved);
  done({ items: items.length });
  return saved;
}

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

  const oauth: YouTubeOAuthClientConfig = {
    clientId: cfg.YOUTUBE_OAUTH_CLIENT_ID,
    clientSecret: cfg.YOUTUBE_OAUTH_CLIENT_SECRET,
    redirectUri: cfg.YOUTUBE_OAUTH_REDIRECT_URI,
  };
  const auth = await getAuthorizedYouTubeAuthState(oauth, requestId);
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

  for (const upload of uploads) {
    upsertUploadArtifact(upload);
  }
  const uploaded = uploads.filter((u) => u.status === 'uploaded').length;
  const failed = uploads.length - uploaded;
  log.info('uploadDraftClips', '[persisted]', requestId, {
    analysisId: input.analysisId,
    uploaded,
    failed,
    savedArtifacts: uploads.length,
  });
  done({ uploaded, total: uploads.length });
  return uploads;
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

function buildDraftItem(clip: ClipArtifact, analysis: ClipPlan, cfg: Config): PublishDraftItem {
  const candidate = analysis.candidates.find((item) => item.id === clip.segmentId);
  const baseTitle = candidate?.reason?.trim() || `${analysis.title} clip`;

  // Use the rendered edited path if available; fall back to the original clip.
  const resolvedPath = clip.editedPath ?? clip.path;

  return {
    clipArtifactId: clip.id,
    segmentId: clip.segmentId,
    filename: clip.filename,
    path: resolvedPath,
    editedPath: clip.editedPath,
    isRenderRequired: false,
    startSec: clip.startSec,
    endSec: clip.endSec,
    durationSec: clip.durationSec,
    transcriptExcerpt: candidate?.transcriptExcerpt ?? '',
    selected: true,
    title: baseTitle.slice(0, 100),
    description: candidate?.transcriptExcerpt ?? '',
    tags: [],
    privacyStatus: cfg.YT_DEFAULT_PRIVACY,
    categoryId: cfg.YT_DEFAULT_CATEGORY_ID,
    license: cfg.YT_DEFAULT_LICENSE,
    selfDeclaredMadeForKids: cfg.YT_DEFAULT_MADE_FOR_KIDS,
    embeddable: cfg.YT_DEFAULT_EMBEDDABLE,
    publicStatsViewable: cfg.YT_DEFAULT_PUBLIC_STATS_VIEWABLE,
    containsSyntheticMedia: cfg.YT_DEFAULT_CONTAINS_SYNTHETIC_MEDIA,
    isShort: cfg.YT_DEFAULT_IS_SHORT,
  };
}
