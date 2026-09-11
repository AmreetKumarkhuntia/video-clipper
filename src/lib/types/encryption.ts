import { z } from 'zod';

/** AES-256 requires 32 bytes: 43 canonical base64 characters and one padding character. */
export const TokenEncryptionKeySchema = z
  .string()
  .regex(
    /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/,
    'Expected a canonical base64-encoded 32-byte key.',
  );
