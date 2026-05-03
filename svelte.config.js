import adapter from '@sveltejs/adapter-node';
import path from 'node:path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      '@lib': path.resolve('./src/lib'),
      '@app/cli': path.resolve('./src/app/cli'),
      '@app/web': path.resolve('./src/app/web'),
    },
    files: {
      appTemplate: 'src/app/web/client/app.html',
      lib: 'src/app/web/client/lib',
      routes: 'src/app/web/client/routes',
    },
  },
};

export default config;
