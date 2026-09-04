import { apiGet } from './index.js';
import type { SettingsResponse } from '@lib/types/api.js';

/**
 * Thresholds, concurrency and the model name are the backend's config now, so
 * the CLI reads them instead of importing one. Tolerant on purpose: they only
 * decorate help text and log lines, `--help` has to work with no backend
 * running, and the calls that genuinely need the backend still fail loudly.
 */
export async function backendSettings(): Promise<Record<string, unknown>> {
  try {
    return (await apiGet<SettingsResponse>('/api/settings')).values;
  } catch {
    return {};
  }
}

export function numberSetting(values: Record<string, unknown>, key: string): number | undefined {
  const value = values[key];
  return typeof value === 'number' ? value : undefined;
}

export function describeSetting(values: Record<string, unknown>, key: string): string {
  const value = values[key];
  return value === undefined || value === null ? 'unknown' : String(value);
}
