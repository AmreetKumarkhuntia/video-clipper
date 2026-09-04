import { Hono } from 'hono';
import { loadOrFetchTranscript, clearVideoTranscript } from '@lib/orchestration/index.js';
import {
  clearChunkAnalysis,
  clearQaMessages,
  clearSegmentations,
  findQaMessages,
  listLibraryVideos,
  removeLibraryVideo,
  saveLibraryVideo,
  upsertVideo,
} from '@lib/services/db/index.js';
import { fetchAvailableCaptionTracks } from '@lib/services/video/index.js';
import { LibraryQuerySchema, VideoParamsSchema } from '@lib/types/api.js';
import { createYouTubeCatalogService } from '../services/catalogFactory.js';
import { requireCustomer } from '../middleware/session.js';
import { HttpError, jsonError } from '../http/responses.js';
import type { ApiEnv } from '../context.js';

/**
 * Everything addressed by a video id: library membership, the transcript, the
 * Q&A thread, and the stored analysis derived from it.
 *
 * Handlers call the orchestrators and repos directly. The prototype routed each
 * of these through a per-app passthrough that only re-exported the same symbol.
 *
 * Membership is per customer and guarded; the transcript and analysis routes
 * below are not, because the CLI still calls them with no way to sign in.
 * Inverting that default is blocked on giving the CLI one.
 */
export const videosRoutes = new Hono<ApiEnv>();

/**
 * One page of the customer's library, newest save first.
 *
 * The prototype served this from `/api/library/videos`. "Library" was a
 * grouping, not a resource — these are videos, filtered to the ones this
 * customer saved.
 */
videosRoutes.get('/', (c) => {
  const customer = requireCustomer(c);
  const { limit, offset } = LibraryQuerySchema.parse({
    limit: c.req.query('limit') ?? undefined,
    offset: c.req.query('offset') ?? undefined,
  });
  return c.json(listLibraryVideos(customer.id, limit, offset));
});

/** Adds a video to the signed-in customer's library. Idempotent. */
videosRoutes.post('/:videoId', async (c) => {
  const customer = requireCustomer(c);
  const { videoId } = VideoParamsSchema.parse({ videoId: c.req.param('videoId') });
  const details = await createYouTubeCatalogService().getVideoDetails(videoId);

  // Checked against the fetched video rather than anything the caller sent, so
  // a request cannot claim someone else's video by asserting a channel id.
  if (!customer.channelId || details.channelId !== customer.channelId) {
    throw new HttpError(jsonError(403, 'You can only add videos from your own channel.'));
  }

  upsertVideo(details);
  saveLibraryVideo({ customerId: customer.id, videoId });
  return c.json({ videoId, saved: true });
});

/** Removes a video from the library. The catalog row and any analyses are untouched. */
videosRoutes.delete('/:videoId', (c) => {
  const customer = requireCustomer(c);
  const { videoId } = VideoParamsSchema.parse({ videoId: c.req.param('videoId') });
  removeLibraryVideo(customer.id, videoId);
  return c.json({ videoId, saved: false });
});

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
