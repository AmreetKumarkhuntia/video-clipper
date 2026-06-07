import type { RequestHandler } from '@sveltejs/kit';
import { fetchAvailableCaptionTracks } from '@lib/services/video/source/youtube/subtitles.js';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

export const GET: RequestHandler = async ({ params, locals }) => {
  const videoId = params.videoId ?? '';
  const reqDone = log.request(
    'GET',
    '/api/videos/[videoId]/transcript/languages',
    locals.requestId,
    { videoId },
  );

  if (!videoId) {
    reqDone(400);
    return jsonError(400, 'Missing videoId.');
  }

  try {
    const tracks = await fetchAvailableCaptionTracks(videoId);
    const languages = tracks.map((t) => ({
      languageCode: t.languageCode,
      label: t.name?.simpleText ?? t.languageCode,
      isAsr: t.kind === 'asr',
    }));
    reqDone(200);
    return jsonOk({ languages });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to fetch available languages.', errorMessage(error));
  }
};
