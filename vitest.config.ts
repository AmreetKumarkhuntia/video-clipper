import { defineConfig } from 'vitest/config';
import { aliases } from './aliases.js';

export default defineConfig({
  resolve: { alias: aliases },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
