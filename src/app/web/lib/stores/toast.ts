import { writable } from 'svelte/store';
import type { Toast } from '@app/web/types/web.js';

export type { Toast };

export const toasts = writable<Toast[]>([]);

let nextId = 0;

export function showToast(type: Toast['type'], message: string, duration = 5000): void {
  const id = String(nextId++);
  toasts.update((list) => [...list, { id, message, type }]);

  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
}

export function dismissToast(id: string): void {
  toasts.update((list) => list.filter((t) => t.id !== id));
}
