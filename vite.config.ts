import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:5003';

// Aliases come from svelte.config.js via the sveltekit() plugin; declaring them
// again here would be a second copy to keep in step.
export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // Keeps the browser same-origin with the API, so cookies, OAuth redirects
    // and the existing relative /api/... calls all work untouched.
    proxy: {
      '/api': { target: API_ORIGIN, changeOrigin: true },
    },
  },
});
