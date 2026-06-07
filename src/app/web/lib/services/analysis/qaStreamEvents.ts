import { log } from '@lib/utils/logger.js';
import type { QaStreamEventName } from '@app/web/types/qa.js';

export type { QaStreamEventName };

export function serializeQaSSE(eventName: QaStreamEventName, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function logEmittedQaEvent(
  requestId: string,
  eventName: QaStreamEventName,
  data: unknown,
): void {
  const meta = summarizeQaEventData(eventName, data);
  log.info(
    'logEmittedQaEvent',
    `[qa-stream] [emit] | ${eventName}${formatEventMeta(meta)}`,
    requestId,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function formatEventMeta(meta: Record<string, unknown>): string {
  const entries = Object.entries(meta).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return '';
  return ' ' + entries.map(([key, value]) => `${key}=${String(value)}`).join(' ');
}

function summarizeQaEventData(
  eventName: QaStreamEventName,
  data: unknown,
): Record<string, unknown> {
  const record = asRecord(data) ?? {};

  if (eventName === 'qa_started') return {};

  if (eventName === 'qa_progress') {
    return {
      textLength: typeof record.text === 'string' ? record.text.length : undefined,
    };
  }

  if (eventName === 'qa_complete') {
    const answer = asRecord(record.answer) ?? {};
    return {
      messageId: answer.messageId,
      citationCount: Array.isArray(answer.citations) ? answer.citations.length : undefined,
    };
  }

  if (eventName === 'error') {
    return { message: record.message };
  }

  return {};
}
