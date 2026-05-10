import { log } from '@lib/utils/logger.js';

import type { UploadStreamEventName } from '@app/web/types/upload.js';

export type { UploadStreamEventName };

export function serializeUploadSSE(eventName: UploadStreamEventName, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function logEmittedUploadEvent(
  requestId: string,
  eventName: UploadStreamEventName,
  data: unknown,
): void {
  const meta = summarizeUploadEvent(eventName, data);
  log.info(
    'logEmittedUploadEvent',
    `[upload-stream] [emit] | ${eventName}${formatEventMeta(meta)}`,
    requestId,
  );
}

function summarizeUploadEvent(
  eventName: UploadStreamEventName,
  data: unknown,
): Record<string, unknown> {
  const record = asRecord(data) ?? {};

  if (eventName === 'upload_started') {
    return {
      clipArtifactId: record.clipArtifactId,
    };
  }

  if (eventName === 'upload_finished' || eventName === 'upload_failed') {
    const upload = asRecord(record.upload) ?? {};
    return {
      clipArtifactId: upload.clipArtifactId,
      status: upload.status,
      title: upload.title,
    };
  }

  if (eventName === 'upload_complete') {
    const uploads = Array.isArray(record.uploads) ? record.uploads : [];
    return {
      total: uploads.length,
    };
  }

  if (eventName === 'error') {
    return { message: record.message };
  }

  return {};
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function formatEventMeta(meta: Record<string, unknown>): string {
  const entries = Object.entries(meta).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return '';
  }

  return ' ' + entries.map(([key, value]) => `${key}=${String(value)}`).join(' ');
}
