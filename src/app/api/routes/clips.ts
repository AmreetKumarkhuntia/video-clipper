import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { Hono } from 'hono';
import { log } from '@lib/utils/logger.js';
import { getClip, listClips, listClipsByAnalysisId } from '@lib/services/db/index.js';
import {
  generateClipsForAnalysis,
  loadClipEdits,
  renderEditedClip,
  saveClipEdits,
} from '@lib/orchestration/index.js';
import { planSubtitles } from '@lib/services/analysis/index.js';
import { CreateClipsRequestSchema } from '@lib/types/analysis.js';
import { ClipEditsSchema } from '@lib/types/clipEdit.js';
import { PlanSubtitlesRequestSchema } from '@lib/types/subtitlePlan.js';
import type { ClipperConfig } from '@lib/types/video.js';
import { errorMessage, jsonError, parseJsonBody } from '../http/responses.js';
import type { ApiEnv } from '../context.js';
import { ClipFileVariantSchema, ClipParamsSchema, ListClipsQuerySchema } from '@lib/types/api.js';

/**
 * Clip generation, the saved-clip library, per-clip edits, rendering and playback.
 *
 * The prototype split the library listing onto `/api/library/clips`; it is the
 * same collection this group already owns, so it is `GET /` here.
 */
export const clipsRoutes = new Hono<ApiEnv>();

clipsRoutes.post('/', async (c) => {
  const input = await parseJsonBody(c.req.raw, CreateClipsRequestSchema);
  const clips = await generateClipsForAnalysis(input, c.get('config'), c.get('requestId'));
  return c.json({ clips });
});

clipsRoutes.get('/', (c) => {
  const { analysisId } = ListClipsQuerySchema.parse({ analysisId: c.req.query('analysisId') });
  const clips = analysisId ? listClipsByAnalysisId(analysisId) : listClips();
  return c.json({ clips });
});

clipsRoutes.get('/:clipId/edits', async (c) => {
  const { clipId } = ClipParamsSchema.parse({ clipId: c.req.param('clipId') });
  const edits = await loadClipEdits(clipId);
  return c.json({ edits });
});

clipsRoutes.put('/:clipId/edits', async (c) => {
  const { clipId } = ClipParamsSchema.parse({ clipId: c.req.param('clipId') });
  const edits = await parseJsonBody(c.req.raw, ClipEditsSchema);

  // The payload carries its own clipId. Trusting it over the URL would let a
  // stale editor tab overwrite a different clip's edits, so a mismatch is a 400
  // rather than something to reconcile.
  if (edits.clipId !== clipId) {
    return jsonError(400, 'clipId in body does not match URL parameter.');
  }

  const saved = await saveClipEdits(edits);
  return c.json({ edits: saved });
});

clipsRoutes.post('/:clipId/render', async (c) => {
  const { clipId } = ClipParamsSchema.parse({ clipId: c.req.param('clipId') });
  const cfg = c.get('config');

  const clipperConfig: ClipperConfig = {
    ffmpegPath: cfg.FFMPEG_PATH,
    ffprobePath: cfg.FFPROBE_PATH,
    ffmpegPreset: cfg.FFMPEG_PRESET,
    outputDir: cfg.OUTPUT_DIR,
    timestampOffset: cfg.TIMESTAMP_OFFSET_SECONDS,
  };

  const clip = await renderEditedClip(clipperConfig, clipId);
  return c.json({ clip });
});

clipsRoutes.post('/:clipId/subtitles/plan', async (c) => {
  const { clipId } = ClipParamsSchema.parse({ clipId: c.req.param('clipId') });
  const input = await parseJsonBody(c.req.raw, PlanSubtitlesRequestSchema);
  const requestId = c.get('requestId');

  // The planner takes only the lines, so this log is the sole record of which
  // clip a plan was requested for.
  log.info('api.clips', 'subtitle plan request', requestId, {
    clipId,
    lines: input.subtitles.length,
  });

  const result = await planSubtitles(input, c.get('config'), requestId);
  return c.json({ lines: result.lines });
});

/**
 * Serves the clip's mp4 for the in-page player.
 *
 * Byte ranges are not an optimisation here: `<video>` seeking depends on the 206
 * plus Content-Range, so the range path and its headers are preserved verbatim.
 */
clipsRoutes.get('/:clipId/file', async (c) => {
  const { clipId } = ClipParamsSchema.parse({ clipId: c.req.param('clipId') });
  const clip = getClip(clipId);

  if (!clip) {
    return jsonError(404, 'Clip not found.');
  }

  // An unrecognised variant deliberately falls back to the default rather than
  // failing the request, so a stale player URL still plays something.
  const parsedVariant = ClipFileVariantSchema.safeParse(c.req.query('variant'));
  const variant = parsedVariant.success ? parsedVariant.data : null;

  let filePath: string;
  if (variant === 'original') {
    filePath = clip.path;
  } else if (variant === 'edited') {
    // Asking for the edit explicitly must not silently hand back the unedited
    // clip — the caller needs to know a render has not happened yet.
    if (!clip.editedPath) {
      return jsonError(404, 'No rendered edit exists for this clip. Render first.');
    }
    filePath = clip.editedPath;
  } else {
    filePath = clip.editedPath ?? clip.path;
  }

  let fileSize: number;
  try {
    fileSize = (await stat(filePath)).size;
  } catch (error) {
    // A row can outlive its file (manual cleanup, an interrupted render). The
    // player needs a 404 to fall back on, not the 500 a thrown ENOENT would give.
    log.warn('api.clips', 'clip file missing on disk', c.get('requestId'), {
      clipId,
      filePath,
      error: errorMessage(error),
    });
    return jsonError(404, 'Clip file not found on disk.');
  }

  const rangeHeader = c.req.header('range');

  if (rangeHeader) {
    const range = parseRangeHeader(rangeHeader, fileSize);

    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const { start, end } = range;
    return new Response(toWebStream(createReadStream(filePath, { start, end })), {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Type': 'video/mp4',
      },
    });
  }

  return new Response(toWebStream(createReadStream(filePath)), {
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    },
  });
});

function parseRangeHeader(
  rangeHeader: string,
  fileSize: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return null;

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  // Only single, satisfiable ranges are answered; anything else falls through to
  // the 416 the caller is expected to retry without a range.
  if (start > end || end >= fileSize) return null;
  return { start, end };
}

/**
 * `Readable.toWeb` is declared against `node:stream/web`, whose `ReadableStream`
 * is a different declaration from the global one `Response` accepts — the same
 * object at runtime, but the two types are not mutually assignable. The assertion
 * is confined here rather than repeated at both call sites.
 */
function toWebStream(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}
