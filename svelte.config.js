import adapter from '@sveltejs/adapter-node';
import { aliases } from './aliases.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: aliases,
    files: {
      appTemplate: 'src/app/web/app.html',
      lib: 'src/app/web/lib',
      routes: 'src/app/web/routes',
      hooks: { server: 'src/app/web/hooks.server.ts' },
    },
  },
};

export default config;
