import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  decryptSecret,
  encryptSecret,
  initTokenCipher,
  isEncryptedSecret,
  resetTokenCipher,
} from '../src/lib/services/encryption/index.js';
import { GOOGLE } from '../src/lib/utils/constants.js';

beforeEach(() => {
  initTokenCipher(randomBytes(32));
});

describe('tokenCipher', () => {
  it('round-trips and marks the stored form', () => {
    const stored = encryptSecret('ya29.secret');
    expect(stored.startsWith(GOOGLE.SIGN_IN.TOKEN_CIPHER_PREFIX)).toBe(true);
    expect(isEncryptedSecret(stored)).toBe(true);
    expect(stored).not.toContain('ya29.secret');
    expect(decryptSecret(stored)).toBe('ya29.secret');
  });

  it('never produces the same ciphertext twice for one value', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('passes a value written before encryption through unchanged', () => {
    expect(isEncryptedSecret('plain-old-token')).toBe(false);
    expect(decryptSecret('plain-old-token')).toBe('plain-old-token');
  });

  it('refuses a tampered value', () => {
    const stored = encryptSecret('secret');
    const tampered = `${stored.slice(0, -2)}AA`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('refuses the wrong key', () => {
    const stored = encryptSecret('secret');
    initTokenCipher(randomBytes(32));
    expect(() => decryptSecret(stored)).toThrow();
  });

  it('refuses to encrypt with no key rather than storing plaintext', () => {
    resetTokenCipher();
    expect(() => encryptSecret('secret')).toThrow(/not initialised/);
  });

  it('rejects a key of the wrong size', () => {
    expect(() => initTokenCipher(randomBytes(16))).toThrow(/32 bytes/);
  });

  it('decrypts a value written before the service move', () => {
    initTokenCipher(Buffer.alloc(32, 7));
    const stored = 'enc:v1:AwMDAwMDAwMDAwMD:IF6GfjqUtx5pZsXz5uk1kg:SZvEYjlRczIILzU1jzKNIZlTi4ra';
    expect(isEncryptedSecret(stored)).toBe(true);
    expect(decryptSecret(stored)).toBe('legacy-provider-token');
  });

  it('takes a copy of the injected key', () => {
    const supplied = randomBytes(32);
    initTokenCipher(supplied);
    const stored = encryptSecret('secret');
    supplied.fill(0);
    expect(decryptSecret(stored)).toBe('secret');
  });

  it('round-trips an empty value', () => {
    expect(decryptSecret(encryptSecret(''))).toBe('');
  });

  it('rejects incomplete, noncanonical and trailing encrypted fields', () => {
    const stored = encryptSecret('secret');
    expect(() => decryptSecret('enc:v1:missing')).toThrow(/malformed/i);
    expect(() => decryptSecret(`${stored}:extra`)).toThrow(/malformed/i);
    expect(() => decryptSecret(`${stored}=`)).toThrow(/malformed/i);
  });
});
