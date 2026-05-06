import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const stored = browser ? (localStorage.getItem('theme') ?? 'light') : 'light';

export const theme = writable<'light' | 'dark'>(stored as 'light' | 'dark');

if (browser) {
  document.documentElement.dataset.theme = stored === 'dark' ? 'dark' : '';
  theme.subscribe((value) => {
    localStorage.setItem('theme', value);
    document.documentElement.dataset.theme = value === 'dark' ? 'dark' : '';
  });
}
