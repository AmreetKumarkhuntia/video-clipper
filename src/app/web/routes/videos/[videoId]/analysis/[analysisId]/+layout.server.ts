import { redirect } from '@sveltejs/kit';
import type { ServerLoadEvent } from '@sveltejs/kit';
import {
  getAnalysis,
  getPublishDraft,
  listClipArtifactsByAnalysisId,
} from '@app/web/lib/services/artifacts/artifactStore.js';
import { getYouTubeAuthStatus } from '@app/web/lib/services/youtube/uploadAuth.js';

export async function load({
  params,
  locals,
  url,
}: ServerLoadEvent<{ videoId: string; analysisId: string }>) {
  const analysisId = params.analysisId;

  const [analysis, clips, authStatus, draft] = await Promise.all([
    getAnalysis(locals.config.OUTPUT_DIR, analysisId),
    listClipArtifactsByAnalysisId(locals.config.OUTPUT_DIR, analysisId),
    getYouTubeAuthStatus(),
    getPublishDraft(locals.config.OUTPUT_DIR, analysisId),
  ]);

  if (!analysis) {
    throw redirect(302, `/videos/${params.videoId}`);
  }

  const path = url.pathname;
  const clipPath = `/videos/${params.videoId}/analysis/${analysisId}`;
  const connectPath = `${clipPath}/connect`;
  const preparePath = `${clipPath}/prepare`;
  const publishPath = `${clipPath}/publish`;
  const hasClips = clips.length > 0;
  const isConnected = authStatus.connected;
  const hasDraft = draft !== null;

  if (path === connectPath && !hasClips) {
    throw redirect(302, clipPath);
  }

  if (path === preparePath && !hasClips) {
    throw redirect(302, clipPath);
  }

  if (path === preparePath && !isConnected) {
    throw redirect(302, connectPath);
  }

  if (path === publishPath && !hasClips) {
    throw redirect(302, clipPath);
  }

  if (path === publishPath && !isConnected) {
    throw redirect(302, connectPath);
  }

  if (path === publishPath && !hasDraft) {
    throw redirect(302, preparePath);
  }

  return {
    workflow: {
      hasClips,
      isConnected,
      hasDraft,
      analysisId,
    },
  };
}
