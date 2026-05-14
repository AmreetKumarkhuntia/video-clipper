import {
  createArtifactId,
  getAnalysis,
  getPublishDraft,
  listClipArtifactsByAnalysisId,
  savePublishDraft,
} from '@app/web/lib/services/artifacts/artifactStore.js';
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
    getAnalysis(cfg.OUTPUT_DIR, analysisId),
    listClipArtifactsByAnalysisId(cfg.OUTPUT_DIR, analysisId),
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

export async function savePublishDraftFromRequest(
  input: SavePublishDraftRequest,
  cfg: Config,
  requestId?: string,
): Promise<PublishDraft> {
  const done = log.fnCalled('savePublishDraft', requestId, { analysisId: input.analysisId });

  const existing = await getPublishDraft(cfg.OUTPUT_DIR, input.analysisId);
  const fallback = existing ?? (await buildPublishDraft(input.analysisId, cfg, requestId));
  const createdAt = fallback?.createdAt ?? new Date().toISOString();

  const saved = await savePublishDraft(
    PublishDraftSchema.parse({
      id: fallback?.id ?? createArtifactId(`publish-${input.videoId}`),
      analysisId: input.analysisId,
      videoId: input.videoId,
      title: input.title,
      createdAt,
      updatedAt: new Date().toISOString(),
      items: input.items,
    }),
    cfg.OUTPUT_DIR,
  );
  done({ items: input.items.length });
  return saved;
}

function buildDraftItem(clip: ClipArtifact, analysis: ClipPlan, cfg: Config): PublishDraftItem {
  const candidate = analysis.candidates.find((item) => item.id === clip.segmentId);
  const baseTitle = candidate?.reason?.trim() || `${analysis.title} clip`;

  // Use the rendered edited path if available; fall back to the original clip.
  const resolvedPath = clip.editedPath ?? clip.path;

  // A render is required when edits exist but haven't been rendered yet, or when the
  // edits have changed since the last render (stale).
  const isRenderRequired =
    !!clip.editsPath &&
    (!clip.editedPath ||
      (!!clip.currentEditsHash &&
        !!clip.lastRenderedHash &&
        clip.currentEditsHash !== clip.lastRenderedHash));

  return {
    clipArtifactId: clip.id,
    segmentId: clip.segmentId,
    filename: clip.filename,
    path: resolvedPath,
    editedPath: clip.editedPath,
    isRenderRequired,
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
