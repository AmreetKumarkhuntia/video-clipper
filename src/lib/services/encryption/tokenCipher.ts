import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ENCRYPTION, GOOGLE } from '@lib/utils/constants.js';

/**
 * Encryption for provider tokens at rest.
 *
 * AES-256-GCM with a random IV per value, so two identical tokens never share
 * a ciphertext and any tampering fails the tag check. The key is handed in by
 * the app at startup. This service never reads configuration or the filesystem;
 * the database service accesses it only through its public barrel.
 *
 * Stored form: `enc:v1:<iv>:<tag>:<ciphertext>`, all base64url. The prefix is
 * what lets a value written before encryption existed read back unchanged and
 * be re-encrypted on its next write.
 */

let key: Buffer | null = null;

export function initTokenCipher(secret: Buffer): void {
  if (secret.length !== ENCRYPTION.KEY_BYTES) {
    throw new Error(
      `Token cipher key must be ${ENCRYPTION.KEY_BYTES} bytes, got ${secret.length}.`,
    );
  }
  key = Buffer.from(secret);
}

/** Tests only: back to the uninitialised state. */
export function resetTokenCipher(): void {
  key = null;
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(GOOGLE.SIGN_IN.TOKEN_CIPHER_PREFIX);
}

/** Refuses rather than silently storing plaintext when no key was provided. */
export function encryptSecret(plain: string): string {
  if (!key) throw new Error('Token cipher not initialised.');
  const iv = randomBytes(ENCRYPTION.IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION.ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${GOOGLE.SIGN_IN.TOKEN_CIPHER_PREFIX}${b64(iv)}:${b64(tag)}:${b64(ciphertext)}`;
}

/**
 * A value without the prefix is one written before encryption existed and is
 * returned as-is. A prefixed value that fails to decrypt — wrong key, edited
 * row — throws; the caller decides whether that is fatal.
 */
export function decryptSecret(stored: string): string {
  if (!isEncryptedSecret(stored)) return stored;
  if (!key) throw new Error('Token cipher not initialised.');
  const parts = stored.slice(GOOGLE.SIGN_IN.TOKEN_CIPHER_PREFIX.length).split(':');
  const [iv, tag, ciphertext] = parts;
  if (parts.length !== 3 || !iv || !tag || ciphertext === undefined) {
    throw new Error('Malformed encrypted value.');
  }
  const decodedIv = Buffer.from(iv, 'base64url');
  const decodedTag = Buffer.from(tag, 'base64url');
  const decodedCiphertext = Buffer.from(ciphertext, 'base64url');
  if (
    decodedIv.length !== ENCRYPTION.IV_BYTES ||
    decodedTag.length !== ENCRYPTION.TAG_BYTES ||
    b64(decodedIv) !== iv ||
    b64(decodedTag) !== tag ||
    b64(decodedCiphertext) !== ciphertext
  ) {
    throw new Error('Malformed encrypted value.');
  }
  const decipher = createDecipheriv(ENCRYPTION.ALGORITHM, key, decodedIv);
  decipher.setAuthTag(decodedTag);
  return Buffer.concat([decipher.update(decodedCiphertext), decipher.final()]).toString('utf8');
}

function b64(buffer: Buffer): string {
  return buffer.toString('base64url');
}
