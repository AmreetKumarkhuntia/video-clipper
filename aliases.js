import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The one place path aliases are declared for the JS-side tooling.
 *
 * Vite, SvelteKit and Vitest all import this. `tsconfig.json` keeps its own
 * `paths` block because TypeScript cannot read JS config, so those two must stay
 * in step — but that is two places instead of the five they used to live in.
 *
 * Resolved relative to this file, not the working directory, so a tool invoked
 * from a subdirectory still resolves correctly.
 */
const root = path.dirname(fileURLToPath(import.meta.url));

export const aliases = {
  '@lib': path.join(root, 'src/lib'),
  '@app/api': path.join(root, 'src/app/api'),
  '@app/cli': path.join(root, 'src/app/cli'),
  '@app/web': path.join(root, 'src/app/web'),
  '@web/lib': path.join(root, 'src/app/web/lib'),
  '@web/components': path.join(root, 'src/app/web/components'),
  '@web/widgets': path.join(root, 'src/app/web/widgets'),
};
