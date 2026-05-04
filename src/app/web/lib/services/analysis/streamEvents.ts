import { log } from '@lib/utils/logger.js';

export type AnalysisStreamEventName =
  | 'chunk_started'
  | 'chunk_progress'
  | 'chunk_analyzed'
  | 'segment_started'
  | 'segment_progress'
  | 'segment_refined'
  | 'analysis_complete'
  | 'error';

export function serializeSSE(eventName: AnalysisStreamEventName, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function logEmittedAnalysisEvent(
  requestId: string,
  eventName: AnalysisStreamEventName,
  data: unknown,
): void {
  const meta = summarizeEventData(eventName, data);
  log.info(`${requestId} [analysis-stream] [emit] | ${eventName}${formatEventMeta(meta)}`);
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

function summarizeEventData(
  eventName: AnalysisStreamEventName,
  data: unknown,
): Record<string, unknown> {
  const record = asRecord(data) ?? {};

  if (eventName === 'chunk_started') {
    return { chunkIndex: record.chunkIndex };
  }

  if (eventName === 'chunk_progress') {
    return {
      chunkIndex: record.chunkIndex,
      textLength: typeof record.text === 'string' ? record.text.length : undefined,
    };
  }

  if (eventName === 'chunk_analyzed') {
    const evaluation = asRecord(record.evaluation) ?? {};
    return {
      chunkIndex: record.chunkIndex,
      status: evaluation.status,
      interesting: evaluation.interesting,
      score: evaluation.score,
    };
  }

  if (eventName === 'segment_started') {
    return { rank: record.rank };
  }

  if (eventName === 'segment_progress') {
    return {
      rank: record.rank,
      textLength: typeof record.text === 'string' ? record.text.length : undefined,
    };
  }

  if (eventName === 'segment_refined') {
    const segment = asRecord(record.segment) ?? {};
    return {
      rank: record.rank,
      start: segment.start,
      end: segment.end,
      score: segment.score,
    };
  }

  if (eventName === 'analysis_complete') {
    const plan = asRecord(record.plan) ?? {};
    const candidates = Array.isArray(plan.candidates) ? plan.candidates : undefined;
    return {
      candidateCount: candidates?.length,
    };
  }

  if (eventName === 'error') {
    return { message: record.message };
  }

  return {};
}
