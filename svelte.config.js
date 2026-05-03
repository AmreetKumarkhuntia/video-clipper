import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    files: {
      appTemplate: 'src/client/app.html',
      lib: 'src/client/lib',
      routes: 'src/client/routes',
    },
  },
};

export default config;
