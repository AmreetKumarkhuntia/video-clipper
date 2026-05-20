import {
  createArtifactId,
  getAnalysis,
  getPublishDraft,
  savePublishDraft,
} from '@app/web/lib/services/artifacts/artifactStore.js';
import { listClipsByAnalysisId } from '@lib/services/db/repos/clipsRepo.js';
import type { ClipArtifact, ClipPlan } from '@app/web/types/analysis.js';
import {
  PublishDraftSchema,
  type PublishDraft,
  type PublishDraftItem,
  type SavePublishDraftRequest,
} from '@app/web/types/publish.js';
import type { Config } from '@lib/types/config.js';
import { log } from '@lib/utils/logger.js';

export async function buildPublishDraft(
  analysisId: string,
  cfg: Config,
  requestId?: string,
): Promise<PublishDraft | null> {
  const done = log.fnCalled('buildPublishDraft', requestId, { analysisId });

  const [analysis, clips] = await Promise.all([
    getAnalysis(analysisId),
    Promise.resolve(listClipsByAnalysisId(analysisId)),
  ]);

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
  const [existingDraft, freshDraft] = await Promise.all([
    getPublishDraft(analysisId),
    buildPublishDraft(analysisId, cfg, requestId),
  ]);

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

  const [existing, fresh] = await Promise.all([
    getPublishDraft(input.analysisId),
    buildPublishDraft(input.analysisId, cfg, requestId),
  ]);
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

  const saved = await savePublishDraft(
    PublishDraftSchema.parse({
      id: existing?.id ?? fresh?.id ?? createArtifactId(`publish-${input.videoId}`),
      analysisId: input.analysisId,
      videoId: input.videoId,
      title: input.title,
      createdAt,
      updatedAt: new Date().toISOString(),
      items,
    }),
  );
  done({ items: items.length });
  return saved;
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
