import { TokenEncryptionKeySchema } from '@lib/types/encryption.js';

/**
 * Read only during API startup. This secret deliberately bypasses the mutable
 * config/file/registry pipeline and is never returned by the settings API.
 */
export function getTokenEncryptionKey(): Buffer {
  const encoded = process.env.TOKEN_ENCRYPTION_KEY;
  const result = TokenEncryptionKeySchema.safeParse(encoded);
  if (!result.success) {
    const problem = encoded === undefined || encoded === '' ? 'Missing' : 'Malformed';
    throw new Error(
      `${problem} TOKEN_ENCRYPTION_KEY. Set it in the server environment to a canonical ` +
        'base64-encoded 32-byte key. For an existing database, use the original key from ' +
        'its auth-token.key backup; do not generate a replacement.',
    );
  }
  return Buffer.from(result.data, 'base64');
}
