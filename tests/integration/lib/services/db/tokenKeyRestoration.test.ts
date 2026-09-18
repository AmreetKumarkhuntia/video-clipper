import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCustomer,
  findIdentity,
  hasEncryptedIdentityTokens,
  linkIdentity,
  validateEncryptedIdentityTokens,
} from '@lib/services/db/index.js';
import { getTokenEncryptionKey } from '@lib/config/index.js';
import { initTokenCipher, resetTokenCipher } from '@lib/services/encryption/index.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../support/postgres.js';

let database: PostgresTestDatabase | undefined;

afterEach(async () => {
  if (database) await database.close();
  database = undefined;
  resetTokenCipher();
  vi.unstubAllEnvs();
});

describe('PostgreSQL restoration with an environment-supplied encryption key', () => {
  it('reopens encrypted data with the original key and rejects missing or replacement keys', async () => {
    database = await createPostgresTestDatabase('token_key_restore');
    const encodedKey = randomBytes(32).toString('base64');
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', encodedKey);
    initTokenCipher(getTokenEncryptionKey());

    const customer = await createCustomer({ email: 'owner@example.com' });
    await linkIdentity({
      customerId: customer.id,
      provider: 'google',
      providerAccountId: 'google-owner',
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
    });
    expect(await hasEncryptedIdentityTokens()).toBe(true);

    await database.reopen();
    resetTokenCipher();
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', undefined);
    expect(() => getTokenEncryptionKey()).toThrow(/missing TOKEN_ENCRYPTION_KEY/i);

    vi.stubEnv('TOKEN_ENCRYPTION_KEY', encodedKey);
    initTokenCipher(getTokenEncryptionKey());
    await expect(validateEncryptedIdentityTokens()).resolves.toBeUndefined();
    expect((await findIdentity(customer.id, 'google'))?.refreshToken).toBe('refresh-secret');

    vi.stubEnv('TOKEN_ENCRYPTION_KEY', randomBytes(32).toString('base64'));
    initTokenCipher(getTokenEncryptionKey());
    await expect(validateEncryptedIdentityTokens()).rejects.toThrow(/cannot be decrypted/i);
  });
});
