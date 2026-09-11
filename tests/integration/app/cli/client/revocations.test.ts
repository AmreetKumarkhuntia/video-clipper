import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  credentialsPath,
  queueCredentialRevocation,
  readCredential,
  readPendingRevocations,
  writeCredential,
} from '@app/cli/client/credentials.js';
import { retireStoredSessions } from '@app/cli/client/revocations.js';
import type { CliCredential } from '@lib/types/command.js';

const baseUrl = 'https://clips.example.com';
const credential: CliCredential = {
  token: 'secret-session-token',
  expiresAt: Date.now() + 60_000,
  customerId: 'customer-1',
  role: 'admin',
};

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-revocations-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('pending CLI session revocations', () => {
  it('removes an offline logout from active use and keeps a secure retry', async () => {
    writeCredential(baseUrl, credential, dir);
    const revoke = vi.fn(async (): Promise<void> => {
      throw new Error(`network failed for ${credential.token}`);
    });

    const result = await retireStoredSessions(baseUrl, revoke, dir);

    expect(result).toEqual({ hadSessions: true, failures: 1 });
    expect(readCredential(baseUrl, dir)).toBeNull();
    expect(readPendingRevocations(baseUrl, dir)).toEqual([credential.token]);
  });

  it('successfully retries and removes pending revocations', async () => {
    writeCredential(baseUrl, credential, dir);
    queueCredentialRevocation(baseUrl, dir);
    const revoke = vi.fn(async (): Promise<void> => {});

    expect(await retireStoredSessions(baseUrl, revoke, dir)).toEqual({
      hadSessions: true,
      failures: 0,
    });
    expect(revoke).toHaveBeenCalledWith(credential.token);
    expect(readPendingRevocations(baseUrl, dir)).toEqual([]);
  });

  it('retains state across repeated retry failures without exposing tokens in results', async () => {
    writeCredential(baseUrl, credential, dir);
    queueCredentialRevocation(baseUrl, dir);
    const revoke = vi.fn(async (): Promise<void> => {
      throw new Error('still offline');
    });

    expect(await retireStoredSessions(baseUrl, revoke, dir)).toEqual({
      hadSessions: true,
      failures: 1,
    });
    expect(await retireStoredSessions(baseUrl, revoke, dir)).toEqual({
      hadSessions: true,
      failures: 1,
    });
    expect(JSON.stringify(await retireStoredSessions(baseUrl, revoke, dir))).not.toContain(
      credential.token,
    );
    expect(readPendingRevocations(baseUrl, dir)).toEqual([credential.token]);
  });

  it('treats corrupt retry state as signed out instead of crashing', async () => {
    fs.writeFileSync(
      credentialsPath(dir),
      '{"version":1,"credentials":{},"pendingRevocations":null}',
    );
    const revoke = vi.fn(async (): Promise<void> => {});

    await expect(retireStoredSessions(baseUrl, revoke, dir)).resolves.toEqual({
      hadSessions: false,
      failures: 0,
    });
    expect(revoke).not.toHaveBeenCalled();
  });
});
