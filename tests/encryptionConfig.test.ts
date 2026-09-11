import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';

const fileState = vi.hoisted(() => ({
  current: {
    LLM_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-provider-key',
    TOKEN_ENCRYPTION_KEY: 'file-secret-must-never-be-used',
    TOKEN_ENCRYPTION_KEY_PATH: '/unused/auth-token.key',
  } as Record<string, unknown>,
  save: vi.fn(),
}));

vi.mock('../src/lib/config/fileStore.js', () => ({
  loadUserConfig: (): Record<string, unknown> => fileState.current,
  saveUserConfig: (values: Record<string, unknown>): void => {
    fileState.current = values;
    fileState.save(values);
  },
}));

import {
  buildConfigRegistry,
  getConfig,
  getGroupedConfig,
  getMaskedConfig,
  getTokenEncryptionKey,
  setConfigValues,
} from '../src/lib/config/index.js';

beforeEach(() => {
  fileState.current = {
    LLM_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-provider-key',
    TOKEN_ENCRYPTION_KEY: 'file-secret-must-never-be-used',
    TOKEN_ENCRYPTION_KEY_PATH: '/unused/auth-token.key',
  };
  fileState.save.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('environment-only token encryption key', () => {
  it('decodes only the environment value and never the stored config value', () => {
    const secret = randomBytes(32);
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', secret.toString('base64'));
    expect(getTokenEncryptionKey()).toEqual(secret);
    expect(fileState.save).not.toHaveBeenCalled();
  });

  it('requires an environment key even when a legacy file path or config value exists', () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', undefined);
    vi.stubEnv('TOKEN_ENCRYPTION_KEY_PATH', '/unused/auth-token.key');
    expect(() => getTokenEncryptionKey()).toThrow(/missing TOKEN_ENCRYPTION_KEY/i);
    expect(fileState.save).not.toHaveBeenCalled();
  });

  it.each([
    '',
    'not-base64',
    Buffer.alloc(16).toString('base64'),
    Buffer.alloc(33).toString('base64'),
    `${Buffer.alloc(32).toString('base64')}\n`,
    Buffer.alloc(32, 255).toString('base64url'),
    `${'A'.repeat(42)}B=`,
  ])('rejects a missing or noncanonical key without including its value', (encoded) => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', encoded);
    let message = '';
    try {
      getTokenEncryptionKey();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/TOKEN_ENCRYPTION_KEY/);
    if (encoded) expect(message).not.toContain(encoded);
  });

  it('omits the key and obsolete path from config, groups, masked settings, and the registry', () => {
    const encoded = randomBytes(32).toString('base64');
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', encoded);
    for (const values of [
      getConfig(),
      getGroupedConfig(),
      getMaskedConfig(),
      buildConfigRegistry(),
    ]) {
      const serialized = JSON.stringify(values);
      expect(serialized).not.toContain('TOKEN_ENCRYPTION_KEY');
      expect(serialized).not.toContain(encoded);
      expect(serialized).not.toContain('file-secret-must-never-be-used');
    }
  });

  it.each(['TOKEN_ENCRYPTION_KEY', 'TOKEN_ENCRYPTION_KEY_PATH'])(
    'rejects setting or clearing %s before any config is saved',
    (key) => {
      for (const value of ['attempted-secret', '', null, undefined]) {
        expect(() => setConfigValues({ [key]: value, SCORE_THRESHOLD: 9 })).toThrow(
          /server environment/,
        );
      }
      expect(fileState.save).not.toHaveBeenCalled();
    },
  );

  it('does not preserve ignored legacy key entries when other settings are saved', () => {
    setConfigValues({ SCORE_THRESHOLD: 8 });
    expect(fileState.current).not.toHaveProperty('TOKEN_ENCRYPTION_KEY');
    expect(fileState.current).not.toHaveProperty('TOKEN_ENCRYPTION_KEY_PATH');
    expect(fileState.current.SCORE_THRESHOLD).toBe(8);
  });
});
