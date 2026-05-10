import path from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      '@lib': path.resolve('./src/lib'),
      '@app/cli': path.resolve('./src/app/cli'),
      '@app/web': path.resolve('./src/app/web'),
      '@web/lib': path.resolve('./src/app/web/lib'),
      '@web/components': path.resolve('./src/app/web/components'),
      '@web/widgets': path.resolve('./src/app/web/widgets'),
    },
  },
});
