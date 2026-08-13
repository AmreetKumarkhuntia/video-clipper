import { resolve, dirname, join } from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

/**
 * Absolute path to the package root, resolved from this module's location.
 *
 * This file lives three levels below the root in both layouts —
 * `src/lib/utils/` when run from source (via tsx) and `dist/lib/utils/`
 * when run from the compiled output — so going up three levels lands at
 * the package root where `scripts/` and `drizzle/` are co-located.
 */
export const PACKAGE_ROOT: string = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

/**
 * Returns the absolute path to a bundled Python script in the `scripts/`
 * directory at the package root.
 *
 * @param name - Filename of the Python script, e.g. `'detect_events.py'`
 */
export function scriptPath(name: string): string {
  return resolve(PACKAGE_ROOT, 'scripts', name);
}

/**
 * Per-user config/state directory (`~/.config/video-clipper`).
 *
 * Home for the user config file, persisted YouTube auth state, and the
 * default SQLite library location.
 */
export function getUserConfigDir(): string {
  return join(os.homedir(), '.config', 'video-clipper');
}
