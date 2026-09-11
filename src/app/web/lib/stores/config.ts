import { writable, get } from 'svelte/store';
import { apiFetch, readApiError } from '@web/lib/api.js';
import { showToast } from './toast.js';
import type { ConfigRegistryResponse } from '@lib/types/config.js';
import type { ConfigApiResponse, ConfigUpdateResponse } from '@app/web/types/web.js';

export const configValues = writable<Record<string, unknown>>({});
export const configRegistry = writable<ConfigRegistryResponse | null>(null);
export const configLoaded = writable(false);

const dirtyKeys = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let canWrite = false;

function scheduleSave(): void {
  if (!canWrite) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void postDirtyFields();
  }, 500);
}

async function postDirtyFields(): Promise<void> {
  saveTimer = null;
  if (!canWrite || dirtyKeys.size === 0) return;

  const values = get(configValues);
  const payload: Record<string, unknown> = {};

  for (const key of dirtyKeys) {
    const value = values[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'hasValue' in (value as Record<string, unknown>)
    ) {
      continue;
    }
    payload[key] = value;
  }

  dirtyKeys.clear();

  if (Object.keys(payload).length === 0) return;

  // Writes need the `settings:write` permission on the backend. The session
  // cookie rides along with the fetch, so an admin's save simply works and a
  // customer's answers 403, which the toast shows.
  try {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body: unknown = await res.json();
      showToast('error', readApiError(body));
      return;
    }

    const body = (await res.json()) as ConfigUpdateResponse;
    configValues.set(body.values);
    showToast('success', 'Settings saved');
  } catch {
    showToast('error', 'Failed to save settings');
  }
}

export async function initConfig(): Promise<void> {
  const { registry, values } = await apiFetch<ConfigApiResponse>('/api/settings');
  configRegistry.set(registry);
  configValues.set(values);
  configLoaded.set(true);
}

export function updateField(key: string, value: unknown): void {
  if (!canWrite) return;
  dirtyKeys.add(key);
  configValues.update((current) => ({ ...current, [key]: value }));
  scheduleSave();
}

export function resetToDefaults(): void {
  if (!canWrite) return;
  void initConfig();
}

/** Cancels a queued autosave as soon as write permission is lost. */
export function setConfigWritable(value: boolean): void {
  canWrite = value;
  if (canWrite) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  dirtyKeys.clear();
}
