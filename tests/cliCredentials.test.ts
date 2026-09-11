import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  credentialKey,
  credentialsPath,
  deleteCredential,
  queueCredentialRevocation,
  readCredential,
  readPendingRevocations,
  writeCredential,
} from '../src/app/cli/client/credentials.js';
import type { CliCredential } from '../src/lib/types/command.js';

const credential: CliCredential = {
  token: 'raw-session-token',
  expiresAt: Date.now() + 60_000,
  customerId: 'customer-1',
  email: 'owner@example.com',
  role: 'admin',
};

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-credentials-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('credentials file', () => {
  it('round-trips a sign-in and forgets it on delete', () => {
    expect(readCredential('http://localhost:5051', dir)).toBeNull();

    writeCredential('http://localhost:5051', credential, dir);
    expect(readCredential('http://localhost:5051', dir)).toEqual(credential);

    deleteCredential('http://localhost:5051', dir);
    expect(readCredential('http://localhost:5051', dir)).toBeNull();
  });

  it('keys by origin, so a path or trailing slash is the same backend', () => {
    expect(credentialKey('http://localhost:5051/')).toBe('http://localhost:5051');
    expect(credentialKey('http://localhost:5051/api')).toBe('http://localhost:5051');
    writeCredential('http://localhost:5051/api', credential, dir);
    expect(readCredential('http://localhost:5051/', dir)?.token).toBe(credential.token);
  });

  it('holds one sign-in per backend', () => {
    writeCredential('http://localhost:5051', credential, dir);
    writeCredential('https://clips.example.com', { ...credential, token: 'remote' }, dir);
    expect(readCredential('http://localhost:5051', dir)?.token).toBe('raw-session-token');
    expect(readCredential('https://clips.example.com', dir)?.token).toBe('remote');
  });

  it.skipIf(process.platform === 'win32')('is readable only by its owner', () => {
    writeCredential('http://localhost:5051', credential, dir);
    const mode = fs.statSync(credentialsPath(dir)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('treats a corrupt file as signed out rather than crashing', () => {
    fs.writeFileSync(credentialsPath(dir), '{not json');
    expect(readCredential('http://localhost:5051', dir)).toBeNull();
    // And recovers on the next write.
    writeCredential('http://localhost:5051', credential, dir);
    expect(readCredential('http://localhost:5051', dir)?.role).toBe('admin');
  });

  it.each([
    ['null', 'null'],
    ['array', '[]'],
    ['primitive', '42'],
    ['null credentials', '{"version":1,"credentials":null}'],
    ['missing fields', '{"version":1,"credentials":{"https://example.com":{"token":"x"}}}'],
    [
      'invalid URL key',
      '{"version":1,"credentials":{"not-a-url":{"token":"x","expiresAt":1,"customerId":"c","role":"admin"}}}',
    ],
    [
      'URL path key',
      '{"version":1,"credentials":{"https://example.com/api":{"token":"x","expiresAt":1,"customerId":"c","role":"admin"}}}',
    ],
    [
      'invalid timestamp',
      '{"version":1,"credentials":{"https://example.com":{"token":"x","expiresAt":"tomorrow","customerId":"c","role":"admin"}}}',
    ],
    [
      'unknown role',
      '{"version":1,"credentials":{"https://example.com":{"token":"x","expiresAt":1,"customerId":"c","role":"owner"}}}',
    ],
    ['unknown version', '{"version":2,"credentials":{}}'],
  ])('safely rejects %s credential state', (_name, raw) => {
    fs.writeFileSync(credentialsPath(dir), raw);
    expect(readCredential('https://example.com', dir)).toBeNull();
    expect(readPendingRevocations('https://example.com', dir)).toEqual([]);
  });

  it('moves an active token into the owner-only revocation queue', () => {
    writeCredential('https://example.com', credential, dir);
    expect(queueCredentialRevocation('https://example.com', dir)).toBe(true);
    expect(readCredential('https://example.com', dir)).toBeNull();
    expect(readPendingRevocations('https://example.com', dir)).toEqual([credential.token]);
    expect(fs.readFileSync(credentialsPath(dir), 'utf8')).not.toContain('owner@example.com');
  });
});
