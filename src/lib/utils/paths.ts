import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Absolute path to the package root, resolved from the compiled output location.
 *
 * At runtime (from `dist/utils/paths.js`), going up two levels lands at the
 * package root where `scripts/` is co-located. This works whether the package
 * is run from source (via tsx) or from a global/local npm install.
 */
export const PACKAGE_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Returns the absolute path to a bundled Python script in the `scripts/`
 * directory at the package root.
 *
 * @param name - Filename of the Python script, e.g. `'detect_events.py'`
 */
export function scriptPath(name: string): string {
  return resolve(PACKAGE_ROOT, 'scripts', name);
}
