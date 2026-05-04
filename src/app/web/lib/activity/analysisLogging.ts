import { dev } from '$app/environment';

const STREAM_TEXT_PREVIEW_LENGTH = 80;

export function logAnalysisEvent(
  name: string,
  meta: Record<string, unknown>,
  level: 'debug' | 'info' | 'error' = 'info',
): void {
  if (!dev) {
    return;
  }

  const logger =
    level === 'debug' ? console.debug : level === 'error' ? console.error : console.info;

  logger(`[analysis-ui] ${name}`, meta);
}

export function previewStreamText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= STREAM_TEXT_PREVIEW_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, STREAM_TEXT_PREVIEW_LENGTH - 3)}...`;
}
