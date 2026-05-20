import { writable, get } from 'svelte/store';
import { TextStyleSchema, PositionSchema } from '@lib/types/clipEdit.js';
import { apiFetch, readApiError } from '@web/lib/api.js';
import { showToast } from './toast.js';
import type { UserCaptionPreset, CaptionPresetApiRecord } from '@app/web/types/captionPreset.js';
import type { TextStyle, Position } from '@lib/types/clipEdit.js';

export const captionPresets = writable<UserCaptionPreset[]>([]);
export const captionPresetsLoaded = writable(false);

function parseRecord(r: CaptionPresetApiRecord): UserCaptionPreset {
  return {
    id: r.id,
    name: r.name,
    style: TextStyleSchema.parse(JSON.parse(r.style)),
    position: PositionSchema.parse(JSON.parse(r.position)),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function loadCaptionPresets(): Promise<void> {
  try {
    const data = await apiFetch<{ presets: CaptionPresetApiRecord[] }>('/api/caption-presets');
    captionPresets.set(data.presets.map(parseRecord));
    captionPresetsLoaded.set(true);
  } catch (error) {
    showToast('error', error instanceof Error ? error.message : 'Failed to load caption presets.');
  }
}

export async function saveCaptionPreset(
  name: string,
  style: TextStyle,
  position: Position,
): Promise<UserCaptionPreset | null> {
  try {
    const data = await apiFetch<{ preset: CaptionPresetApiRecord }>('/api/caption-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, style, position }),
    });
    const preset = parseRecord(data.preset);
    captionPresets.update((list) => [...list, preset]);
    showToast('success', `Preset "${name}" saved.`);
    return preset;
  } catch (error) {
    showToast('error', error instanceof Error ? error.message : 'Failed to save preset.');
    return null;
  }
}

export async function updateCaptionPreset(
  id: string,
  updates: { name?: string; style?: TextStyle; position?: Position },
): Promise<UserCaptionPreset | null> {
  try {
    const data = await apiFetch<{ preset: CaptionPresetApiRecord }>(`/api/caption-presets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const preset = parseRecord(data.preset);
    captionPresets.update((list) => list.map((p) => (p.id === id ? preset : p)));
    showToast('success', `Preset "${preset.name}" updated.`);
    return preset;
  } catch (error) {
    showToast('error', error instanceof Error ? error.message : 'Failed to update preset.');
    return null;
  }
}

export async function deleteCaptionPreset(id: string): Promise<boolean> {
  const name = get(captionPresets).find((p) => p.id === id)?.name ?? 'Preset';
  try {
    const res = await fetch(`/api/caption-presets/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body: unknown = await res.json();
      showToast('error', readApiError(body));
      return false;
    }
    captionPresets.update((list) => list.filter((p) => p.id !== id));
    showToast('success', `Preset "${name}" deleted.`);
    return true;
  } catch {
    showToast('error', 'Failed to delete preset.');
    return false;
  }
}
