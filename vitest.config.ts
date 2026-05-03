import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@lib': path.resolve('./src/lib'),
      '@app/cli': path.resolve('./src/app/cli'),
      '@app/web': path.resolve('./src/app/web'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
