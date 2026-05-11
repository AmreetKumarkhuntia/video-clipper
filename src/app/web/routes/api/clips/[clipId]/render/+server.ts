import type { RequestHandler } from '@sveltejs/kit';
import type { ClipperConfig } from '@lib/types/video.js';
import { ClipParamsSchema } from '@app/web/types/analysis.js';
import { renderEditedClip } from '@app/web/lib/services/clipping/clipEditService.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

export const POST: RequestHandler = async ({ params, locals }) => {
  const reqDone = log.request('POST', '/api/clips/[clipId]/render', locals.requestId, {
    clipId: params.clipId,
  });
  const parsed = ClipParamsSchema.safeParse(params);

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid clip id.', zodErrorDetail(parsed.error));
  }

  const cfg: ClipperConfig = {
    ffmpegPath: locals.config.FFMPEG_PATH,
    ffprobePath: locals.config.FFPROBE_PATH,
    ffmpegPreset: locals.config.FFMPEG_PRESET,
    outputDir: locals.config.OUTPUT_DIR,
    timestampOffset: locals.config.TIMESTAMP_OFFSET_SECONDS,
  };

  try {
    const clip = await renderEditedClip(locals.config.OUTPUT_DIR, cfg, parsed.data.clipId);
    reqDone(200);
    return jsonOk({ clip });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to render clip.', errorMessage(error));
  }
};
