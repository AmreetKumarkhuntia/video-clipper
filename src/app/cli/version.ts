import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** Read the installed manifest so release-time versioning never leaves a stale bundle version. */
export function cliVersion(): string {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      return z
        .object({ version: z.string().min(1) })
        .parse(JSON.parse(readFileSync(manifest, 'utf8'))).version;
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Cannot find the CLI package version.');
    directory = parent;
  }
}
