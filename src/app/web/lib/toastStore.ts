import { writable } from 'svelte/store';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

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
