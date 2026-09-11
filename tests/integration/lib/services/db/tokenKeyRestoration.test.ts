import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import {
  createCustomer,
  findIdentity,
  getDb,
  hasEncryptedIdentityTokens,
  initDb,
  linkIdentity,
  validateEncryptedIdentityTokens,
} from '@lib/services/db/index.js';
import { initTokenCipher, resetTokenCipher } from '@lib/services/encryption/index.js';
import { getTokenEncryptionKey } from '@lib/config/index.js';

const dirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-token-key-'));
  dirs.push(dir);
  return dir;
}

function migrateCurrentDatabase(): void {
  migrate(getDb(), { migrationsFolder: path.join(process.cwd(), 'drizzle') });
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('database restoration with an environment-supplied encryption key', () => {
  it('restores encrypted data with the original key and rejects a replacement key', () => {
    const source = tempDir();
    const sourceDb = path.join(source, 'library.sqlite');
    const encodedKey = randomBytes(32).toString('base64');
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', encodedKey);
    initDb(sourceDb);
    migrateCurrentDatabase();
    initTokenCipher(getTokenEncryptionKey());

    const customer = createCustomer({ email: 'owner@example.com' });
    linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: 'google-owner',
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
    });
    expect(hasEncryptedIdentityTokens()).toBe(true);

    // A stopped-server backup has no live WAL. Checkpoint here to model that
    // before restoring the database with the same environment secret.
    const checkpoint = new Database(sourceDb);
    checkpoint.pragma('wal_checkpoint(TRUNCATE)');
    checkpoint.close();

    const restored = tempDir();
    const restoredDb = path.join(restored, 'library.sqlite');
    fs.copyFileSync(sourceDb, restoredDb);

    initDb(restoredDb);
    resetTokenCipher();
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', undefined);
    expect(() => getTokenEncryptionKey()).toThrow(/missing TOKEN_ENCRYPTION_KEY/i);
    expect(fs.existsSync(path.join(restored, 'auth-token.key'))).toBe(false);

    vi.stubEnv('TOKEN_ENCRYPTION_KEY', encodedKey);
    initTokenCipher(getTokenEncryptionKey());
    expect(() => validateEncryptedIdentityTokens()).not.toThrow();
    expect(findIdentity(customer.id, 'google')?.refreshToken).toBe('refresh-secret');

    vi.stubEnv('TOKEN_ENCRYPTION_KEY', randomBytes(32).toString('base64'));
    initTokenCipher(getTokenEncryptionKey());
    expect(() => validateEncryptedIdentityTokens()).toThrow(/cannot be decrypted/i);
  });
});
