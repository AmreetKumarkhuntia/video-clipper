import type { LoginErrorCode } from '@lib/types/auth.js';

/**
 * A sign-in rejection with a code the login page can act on.
 *
 * The message stays the sentence a person should read, so callers that only
 * know `Error` lose nothing; the code is what the route puts in the URL, and
 * `detail` is the one piece of upstream text worth carrying (a provider's
 * error name, say) — shown next to the copy, never instead of it.
 */
export class SignInError extends Error {
  readonly code: LoginErrorCode;
  readonly detail?: string;

  constructor(code: LoginErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'SignInError';
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}
