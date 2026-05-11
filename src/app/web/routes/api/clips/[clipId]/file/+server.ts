import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import type { RequestHandler } from '@sveltejs/kit';
import { ClipParamsSchema } from '@app/web/types/analysis.js';
import { getClipArtifact } from '@app/web/lib/services/artifacts/artifactStore.js';
import { jsonError, zodErrorDetail } from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

function parseRangeHeader(
  rangeHeader: string,
  fileSize: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return null;

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start > end || end >= fileSize) return null;
  return { start, end };
}

export const GET: RequestHandler = async ({ params, locals, request }) => {
  const reqDone = log.request('GET', '/api/clips/[clipId]/file', locals.requestId, {
    clipId: params.clipId,
  });
  const parsed = ClipParamsSchema.safeParse(params);

  if (!parsed.success) {
    reqDone(400);
    return jsonError(400, 'Invalid clip id.', zodErrorDetail(parsed.error));
  }

  const artifact = await getClipArtifact(locals.config.OUTPUT_DIR, parsed.data.clipId);

  if (!artifact) {
    reqDone(404);
    return jsonError(404, 'Clip not found.');
  }

  const filePath = artifact.editedPath ?? artifact.path;

  let fileSize: number;
  try {
    const info = await stat(filePath);
    fileSize = info.size;
  } catch {
    reqDone(404);
    return jsonError(404, 'Clip file not found on disk.');
  }

  const rangeHeader = request.headers.get('range');

  if (rangeHeader) {
    const range = parseRangeHeader(rangeHeader, fileSize);

    if (!range) {
      reqDone(416);
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const { start, end } = range;
    const chunkSize = end - start + 1;
    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    reqDone(206);
    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'video/mp4',
      },
    });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  reqDone(200);
  return new Response(webStream, {
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    },
  });
};
