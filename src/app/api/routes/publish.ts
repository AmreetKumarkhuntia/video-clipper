import { promises as fs } from 'node:fs';
import { extname, join } from 'node:path';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { log } from '@lib/utils/logger.js';
import { listUploadArtifactsByAnalysisId } from '@lib/services/db/index.js';
import {
  loadAndRefreshPublishDraft,
  savePublishDraftFromRequest,
  uploadDraftClips,
} from '@lib/orchestration/publishOrchestrator.js';
import { generatePublishMetadata, loadYouTubeAuthState } from '@lib/services/publish/index.js';
import {
  CreateUploadsRequestSchema,
  GeneratePublishMetadataRequestSchema,
  SavePublishDraftRequestSchema,
} from '@lib/types/publish.js';
import { jsonError, parseJsonBody } from '../http/responses.js';
import { logEmittedUploadEvent, serializeUploadSSE } from '../http/sse/uploadEvents.js';
import type { UploadStreamEventName } from '../http/sse/uploadEvents.js';
import type { ApiEnv } from '../context.js';
import { AnalysisParamsSchema } from '@lib/types/api.js';

/**
 * The publish flow: drafts, generated metadata, thumbnails, and uploads.
 *
 * Uploads live here rather than under `/api/youtube` because they are our
 * publish pipeline, not a proxy of the YouTube Data API.
 */
export const publishRoutes = new Hono<ApiEnv>();

const ALLOWED_THUMBNAIL_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_THUMBNAIL_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

publishRoutes.post('/drafts', async (c) => {
  const input = await parseJsonBody(c.req.raw, SavePublishDraftRequestSchema);
  const draft = await savePublishDraftFromRequest(input, c.get('config'), c.get('requestId'));
  return c.json({ draft });
});

publishRoutes.post('/drafts/generate', async (c) => {
  const input = await parseJsonBody(c.req.raw, GeneratePublishMetadataRequestSchema);

  // The upload channel name is only a hint for the prompt, so a missing or
  // unreadable connection must not fail generation.
  const auth = await loadYouTubeAuthState().catch(() => null);

  const items = await generatePublishMetadata(
    input.workflowTitle,
    input.items,
    c.get('config'),
    {
      videoDescription: input.videoDescription,
      sourceChannelTitle: input.sourceChannelTitle,
      uploadChannelName: auth?.channel.title,
    },
    c.get('requestId'),
  );

  return c.json({ items });
});

publishRoutes.get('/drafts/:analysisId', async (c) => {
  const { analysisId } = AnalysisParamsSchema.parse({ analysisId: c.req.param('analysisId') });
  const draft = await loadAndRefreshPublishDraft(analysisId, c.get('config'), c.get('requestId'));

  // A missing draft is not an error: the analysis simply has no clips to
  // publish yet, and the client renders an empty publish tab for it.
  if (!draft) {
    return jsonError(404, 'Publish draft could not be created for this analysis yet.');
  }

  return c.json({ draft });
});

publishRoutes.post('/thumbnails', async (c) => {
  const formData = await c.req.formData();
  const clipArtifactId = formData.get('clipArtifactId');
  const file = formData.get('file');

  if (typeof clipArtifactId !== 'string' || !clipArtifactId.trim()) {
    return jsonError(400, 'Missing clipArtifactId field.');
  }

  // The id becomes the filename, so anything that could climb out of the
  // thumbnail directory is rejected before it reaches the filesystem.
  if (/[/\\]/.test(clipArtifactId) || clipArtifactId.includes('..')) {
    return jsonError(400, 'Invalid clipArtifactId field.');
  }

  if (!(file instanceof File)) {
    return jsonError(400, 'Missing file field.');
  }

  const mimeType = file.type.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_THUMBNAIL_MIME_TYPES.has(mimeType)) {
    return jsonError(400, `Unsupported image type: ${mimeType}. Use JPEG, PNG, or WebP.`);
  }

  const ext = extname(file.name).toLowerCase() || mimeTypeToExtension(mimeType);
  if (!ALLOWED_THUMBNAIL_EXTENSIONS.has(ext)) {
    return jsonError(400, `Unsupported file extension: ${ext}.`);
  }

  const thumbnailDir = join(c.get('config').OUTPUT_DIR, 'thumbnails');
  await fs.mkdir(thumbnailDir, { recursive: true });

  const outputPath = join(thumbnailDir, `${clipArtifactId}${ext}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(outputPath, buffer);

  log.info('api.publish', 'thumbnail saved', c.get('requestId'), {
    clipArtifactId,
    path: outputPath,
    bytes: buffer.length,
  });

  return c.json({ path: outputPath });
});

publishRoutes.get('/uploads', (c) => {
  const { analysisId } = AnalysisParamsSchema.parse({ analysisId: c.req.query('analysisId') });
  const uploads = listUploadArtifactsByAnalysisId(analysisId);
  return c.json({ uploads });
});

publishRoutes.post('/uploads', async (c) => {
  const input = await parseJsonBody(c.req.raw, CreateUploadsRequestSchema);
  const requestId = c.get('requestId');

  const uploads = await uploadDraftClips(input, c.get('config'), requestId);

  // Uploads hit an external API per clip and partially fail, so the outcome
  // is worth a line even when the request itself succeeded.
  const uploaded = uploads.filter((upload) => upload.status === 'uploaded').length;
  log.info('api.publish', 'upload complete', requestId, {
    analysisId: input.analysisId,
    uploaded,
    failed: uploads.length - uploaded,
    total: uploads.length,
  });

  return c.json({ uploads });
});

/**
 * The streaming variant of the upload run.
 *
 * PUT is carried over from the prototype, where it was only a way to give the
 * same path a second body-carrying method; `POST /uploads/stream` is the
 * honest shape once the client can be changed.
 */
publishRoutes.put('/uploads', async (c) => {
  const input = await parseJsonBody(c.req.raw, CreateUploadsRequestSchema);
  const requestId = c.get('requestId');
  const cfg = c.get('config');

  return streamSSE(c, async (stream) => {
    // The orchestrator's progress callbacks are synchronous, so writes are
    // queued in call order instead of awaited one at a time.
    const send = (eventName: UploadStreamEventName, data: unknown): void => {
      logEmittedUploadEvent(requestId, eventName, data);
      void stream.write(serializeUploadSSE(eventName, data));
    };

    try {
      const uploads = await uploadDraftClips(input, cfg, requestId, {
        onUploadStarted: (item) => send('upload_started', { clipArtifactId: item.clipArtifactId }),
        onUploadFinished: (upload) => send('upload_finished', { upload }),
        onUploadFailed: (upload) => send('upload_failed', { upload }),
      });

      send('upload_complete', { uploads });
    } catch (error) {
      // A stream that has already emitted events cannot switch to an error
      // envelope, so the failure is reported as a terminal event instead.
      send('error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
});

function mimeTypeToExtension(mimeType: string): string {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}
