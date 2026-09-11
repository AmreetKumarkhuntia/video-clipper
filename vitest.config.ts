import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { aliases } from './aliases.js';

export default defineConfig({
  plugins: [svelte()],
  resolve: { alias: aliases },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
