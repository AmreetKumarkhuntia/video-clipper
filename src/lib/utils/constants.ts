/** Shared protocol constants, independent of deployment configuration. */
export const GOOGLE = {
  SIGN_IN: {
    TOKEN_CIPHER_PREFIX: 'enc:v1:',
  },
} as const;

export const ENCRYPTION = {
  ALGORITHM: 'aes-256-gcm',
  KEY_BYTES: 32,
  IV_BYTES: 12,
  TAG_BYTES: 16,
} as const;

export const CLI = {
  AUTH: {
    LOGIN_TTL_MS: 10 * 60 * 1000,
    EXCHANGE_TTL_MS: 60 * 1000,
    HANDSHAKE_TTL_SEC: 60 * 10,
    REQUEST_COOKIE: 'vc_cli_login_request',
    MAX_BODY_BYTES: 8 * 1024,
  },
} as const;
