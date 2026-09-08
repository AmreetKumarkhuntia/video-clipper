import { redirect } from '@sveltejs/kit';
import type { ServerLoadEvent } from '@sveltejs/kit';
import { backendFetch, backendJson } from '@web/lib/server/backend.js';
import type { ClipArtifact, ClipPlan } from '@app/web/types/analysis.js';
import type { PublishDraft, YouTubeAuthStatus } from '@app/web/types/publish.js';

/**
 * Gates the publish workflow so a step is only reachable once the one before it
 * is satisfied.
 *
 * Every fact now comes from the backend over HTTP rather than from a direct
 * library call — this app holds no domain logic and opens no database.
 */
export async function load({
  params,
  url,
  cookies,
}: ServerLoadEvent<{ videoId: string; analysisId: string }>) {
  const analysisId = params.analysisId;

  const [analysis, clips, connection, draft] = await Promise.all([
    backendJson<ClipPlan | null>(`/api/analyses/${analysisId}`, cookies).catch(() => null),
    backendJson<{ clips: ClipArtifact[] }>(`/api/clips?analysisId=${analysisId}`, cookies)
      .then((r) => r.clips)
      .catch(() => []),
    backendJson<YouTubeAuthStatus>('/api/youtube/connection', cookies).catch(() => ({
      connected: false,
      oauthConfigured: false,
    })),
    // A missing draft is an expected state, not an error, so 404 maps to null.
    backendFetch(`/api/publish/drafts/${analysisId}`, cookies).then(async (res) =>
      res.ok ? ((await res.json()) as { draft: PublishDraft | null }).draft : null,
    ),
  ]);

  if (!analysis) {
    throw redirect(302, `/videos/${params.videoId}`);
  }

  const clipPath = `/videos/${params.videoId}/analysis/${analysisId}`;
  const connectPath = `${clipPath}/connect`;
  const preparePath = `${clipPath}/prepare`;
  const publishPath = `${clipPath}/publish`;

  const hasClips = clips.length > 0;
  const isConnected = connection.connected;
  const hasDraft = draft !== null;

  // Each step falls back to the earliest one whose precondition is unmet.
  const path = url.pathname;
  if ([connectPath, preparePath, publishPath].includes(path) && !hasClips) {
    throw redirect(302, clipPath);
  }
  if ([preparePath, publishPath].includes(path) && !isConnected) {
    throw redirect(302, connectPath);
  }
  if (path === publishPath && !hasDraft) {
    throw redirect(302, preparePath);
  }

  return { workflow: { hasClips, isConnected, hasDraft, analysisId } };
}
