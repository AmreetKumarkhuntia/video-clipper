import fs from 'node:fs';
import path from 'node:path';
import { getUserConfigDir } from '@lib/utils/paths.js';
import { CliCredentialsFileSchema } from '@lib/types/command.js';
import type { CliCredential, CliCredentialsFile } from '@lib/types/command.js';

/**
 * Where the CLI keeps the session it signed in with.
 *
 * A raw session token on disk, so the file is owner-only: the directory is
 * created 0700 and the file written 0600 through a temp file and rename, and
 * an existing file with looser permissions is tightened on the next write.
 * On Windows those modes are no-ops and the user profile's ACL is the
 * protection. Keyed by backend origin so a local and a remote sign-in can
 * coexist.
 */

const FILE_NAME = 'credentials.json';

export function credentialsPath(dir: string = getUserConfigDir()): string {
  return path.join(dir, FILE_NAME);
}

/** `http://host:5051/api` and `http://host:5051/` are the same backend. */
export function credentialKey(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

function readFile(dir: string): CliCredentialsFile {
  const empty: CliCredentialsFile = { version: 1, credentials: {}, pendingRevocations: {} };
  try {
    const raw = fs.readFileSync(credentialsPath(dir), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const result = CliCredentialsFileSchema.safeParse(parsed);
    return result.success ? result.data : empty;
  } catch {
    // Missing or corrupt: either way there is nothing to be signed in as.
    return empty;
  }
}

function writeFile(dir: string, file: CliCredentialsFile): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const target = credentialsPath(dir);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, target);
  // A pre-existing file keeps its old mode through rename on some platforms.
  fs.chmodSync(target, 0o600);
}

export function readCredential(baseUrl: string, dir?: string): CliCredential | null {
  return readFile(dir ?? getUserConfigDir()).credentials[credentialKey(baseUrl)] ?? null;
}

export function writeCredential(baseUrl: string, credential: CliCredential, dir?: string): void {
  const resolved = dir ?? getUserConfigDir();
  const file = readFile(resolved);
  file.credentials[credentialKey(baseUrl)] = credential;
  writeFile(resolved, file);
}

export function deleteCredential(baseUrl: string, dir?: string): void {
  const resolved = dir ?? getUserConfigDir();
  const file = readFile(resolved);
  if (!(credentialKey(baseUrl) in file.credentials)) return;
  delete file.credentials[credentialKey(baseUrl)];
  writeFile(resolved, file);
}

/**
 * Removes an active bearer from its normal location and queues it for remote
 * revocation in the same owner-only atomic write.
 */
export function queueCredentialRevocation(baseUrl: string, dir?: string): boolean {
  const resolved = dir ?? getUserConfigDir();
  const file = readFile(resolved);
  const key = credentialKey(baseUrl);
  const credential = file.credentials[key];
  if (!credential) return false;

  delete file.credentials[key];
  const queued = file.pendingRevocations[key] ?? [];
  if (!queued.includes(credential.token)) queued.push(credential.token);
  file.pendingRevocations[key] = queued;
  writeFile(resolved, file);
  return true;
}

export function readPendingRevocations(baseUrl: string, dir?: string): string[] {
  const file = readFile(dir ?? getUserConfigDir());
  return [...(file.pendingRevocations[credentialKey(baseUrl)] ?? [])];
}

export function deletePendingRevocation(baseUrl: string, token: string, dir?: string): void {
  const resolved = dir ?? getUserConfigDir();
  const file = readFile(resolved);
  const key = credentialKey(baseUrl);
  const remaining = (file.pendingRevocations[key] ?? []).filter((value) => value !== token);
  if (remaining.length > 0) file.pendingRevocations[key] = remaining;
  else delete file.pendingRevocations[key];
  writeFile(resolved, file);
}
