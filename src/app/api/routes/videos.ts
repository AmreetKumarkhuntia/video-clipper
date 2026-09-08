import { Hono } from 'hono';
import { loadOrFetchTranscript, clearVideoTranscript } from '@lib/orchestration/index.js';
import {
  clearChunkAnalysis,
  clearQaMessages,
  clearSegmentations,
  findQaMessages,
} from '@lib/services/db/index.js';
import { fetchAvailableCaptionTracks } from '@lib/services/video/index.js';
import { VideoParamsSchema } from '@lib/types/api.js';
import type { ApiEnv } from '../context.js';

/**
 * Everything addressed by a video id: its transcript, its Q&A thread, and the
 * stored analysis derived from it.
 *
 * Handlers call the orchestrators and repos directly. The prototype routed each
 * of these through a per-app passthrough that only re-exported the same symbol.
 */
export const videosRoutes = new Hono<ApiEnv>();

videosRoutes.get('/:videoId/transcript', async (c) => {
  const { videoId } = VideoParamsSchema.parse({ videoId: c.req.param('videoId') });

  // Absent, the orchestrator serves whatever transcript is already stored; a
  // language forces a fresh fetch in that language.
  const languageCode = c.req.query('lang') ?? undefined;

  const bundle = await loadOrFetchTranscript(videoId, c.get('config'), languageCode);
  return c.json(bundle);
});

videosRoutes.delete('/:videoId/transcript', (c) => {
  const { videoId } = VideoParamsSchema.parse({ videoId: c.req.param('videoId') });
  const { dbCleared } = clearVideoTranscript(videoId);
  return c.json({ ok: true, dbCleared });
});

videosRoutes.get('/:videoId/transcript/languages', async (c) => {
  const { videoId } = VideoParamsSchema.parse({ videoId: c.req.param('videoId') });
  const tracks = await fetchAvailableCaptionTracks(videoId);

  const languages = tracks.map((track) => ({
    languageCode: track.languageCode,
    label: track.name?.simpleText ?? track.languageCode,
    isAsr: track.kind === 'asr',
  }));

  return c.json({ languages });
});

videosRoutes.get('/:videoId/qa', (c) => {
  const { videoId } = VideoParamsSchema.parse({ videoId: c.req.param('videoId') });
  return c.json(findQaMessages(videoId));
});

videosRoutes.delete('/:videoId/qa', (c) => {
  const { videoId } = VideoParamsSchema.parse({ videoId: c.req.param('videoId') });
  return c.json({ ok: true, cleared: clearQaMessages(videoId) });
});

videosRoutes.delete('/:videoId/analysis', (c) => {
  const { videoId } = VideoParamsSchema.parse({ videoId: c.req.param('videoId') });

  // Chunk analysis is blanked in place rather than deleted because the chunk
  // rows themselves belong to the transcript, which this route leaves alone.
  const chunksCleared = clearChunkAnalysis(videoId);
  const segmentationsCleared = clearSegmentations(videoId);

  return c.json({ ok: true, chunksCleared, segmentationsCleared });
});
