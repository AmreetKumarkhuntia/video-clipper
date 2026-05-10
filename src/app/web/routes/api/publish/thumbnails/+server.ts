import { promises as fs } from 'fs';
import { extname, join } from 'path';
import type { RequestHandler } from '@sveltejs/kit';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { log } from '@lib/utils/logger.js';

const ALLOWED_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export const POST: RequestHandler = async (event) => {
  const reqDone = log.request('POST', '/api/publish/thumbnails', event.locals.requestId);

  try {
    const formData = await event.request.formData();
    const clipArtifactId = formData.get('clipArtifactId');
    const file = formData.get('file');

    if (typeof clipArtifactId !== 'string' || !clipArtifactId.trim()) {
      reqDone(400);
      return jsonError(400, 'Missing clipArtifactId field.');
    }

    if (!(file instanceof File)) {
      reqDone(400);
      return jsonError(400, 'Missing file field.');
    }

    const mimeType = file.type.split(';')[0].trim().toLowerCase();
    if (!ALLOWED_MIME_PREFIXES.some((prefix) => mimeType === prefix)) {
      reqDone(400);
      return jsonError(400, `Unsupported image type: ${mimeType}. Use JPEG, PNG, or WebP.`);
    }

    const ext = extname(file.name).toLowerCase() || mimeTypeToExt(mimeType);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      reqDone(400);
      return jsonError(400, `Unsupported file extension: ${ext}.`);
    }

    const thumbnailDir = join(event.locals.config.OUTPUT_DIR, 'thumbnails');
    await fs.mkdir(thumbnailDir, { recursive: true });

    const filename = `${clipArtifactId}${ext}`;
    const outputPath = join(thumbnailDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(outputPath, buffer);

    log.info('POST /api/publish/thumbnails', 'thumbnail saved', event.locals.requestId, {
      clipArtifactId,
      path: outputPath,
      bytes: buffer.length,
    });

    reqDone(200);
    return jsonOk({ path: outputPath });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to save thumbnail.', errorMessage(error));
  }
};

function mimeTypeToExt(mimeType: string): string {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}
