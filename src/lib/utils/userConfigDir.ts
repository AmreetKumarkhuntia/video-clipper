import { join } from 'node:path';
import { homedir } from 'node:os';

/** Per-user state directory shared by the installed CLI and local server tooling. */
export function getUserConfigDir(): string {
  return join(homedir(), '.config', 'video-clipper');
}
