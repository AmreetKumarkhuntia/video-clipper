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
      '@web/lib': path.resolve('./src/app/web/lib'),
      '@web/components': path.resolve('./src/app/web/components'),
      '@web/widgets': path.resolve('./src/app/web/widgets'),
    },
    files: {
      appTemplate: 'src/app/web/app.html',
      lib: 'src/app/web/lib',
      routes: 'src/app/web/routes',
    },
  },
};

export default config;
