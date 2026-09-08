import { createHash, randomBytes } from 'node:crypto';

/**
 * Session token mechanics.
 *
 * Kept out of the orchestrator so the sign-in flow reads as policy rather than
 * crypto, and kept provider-agnostic: a session is ours, not Google's, so this
 * must not reach for the OAuth helpers the way the prototype did.
 */

/** 256 bits, the same strength the PKCE verifier uses. */
const TOKEN_BYTES = 32;

/** Mints the opaque token handed to the client. Only its hash is ever stored. */
export function createSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** The session cookie carries the raw token; only this hash is ever stored or logged. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
