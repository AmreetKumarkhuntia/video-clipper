import { writable, get } from 'svelte/store';
import { apiFetch, readApiError } from '@web/lib/api.js';
import { showToast } from '@web/lib/toastStore.js';
import type { ConfigRegistryResponse } from '@lib/config/registry.js';

export const configValues = writable<Record<string, unknown>>({});
export const configRegistry = writable<ConfigRegistryResponse | null>(null);
export const configLoaded = writable(false);

interface ConfigApiResponse {
  registry: ConfigRegistryResponse;
  values: Record<string, unknown>;
}

interface ConfigUpdateResponse {
  success: boolean;
  warnings: string[];
  values: Record<string, unknown>;
}

const dirtyKeys = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void postDirtyFields();
  }, 500);
}

async function postDirtyFields(): Promise<void> {
  if (dirtyKeys.size === 0) return;

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

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
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
  const { registry, values } = await apiFetch<ConfigApiResponse>('/api/config');
  configRegistry.set(registry);
  configValues.set(values);
  configLoaded.set(true);
}

export function updateField(key: string, value: unknown): void {
  dirtyKeys.add(key);
  configValues.update((current) => ({ ...current, [key]: value }));
  scheduleSave();
}

export function resetToDefaults(): void {
  void initConfig();
}
