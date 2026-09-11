import { LoginErrorCodeSchema } from '@lib/types/auth.js';
import type { LoginErrorCode } from '@lib/types/auth.js';

/**
 * Copy for each way a sign-in can fail. The URL carries a code, so nothing an
 * upstream said is rendered verbatim; `detail` is the one word the backend
 * chose to pass along, shown beside the copy where it helps.
 */
const COPY: Record<LoginErrorCode, string> = {
  not_configured:
    'Sign-in is not set up on this server yet. Configure the Google OAuth client and try again.',
  provider_denied: 'Google did not complete the sign-in.',
  state_mismatch: 'Sign-in could not be verified. Please try again.',
  no_channel:
    'This Google account has no YouTube channel. Sign in with the account that owns your channel.',
  channel_claimed: 'That channel is already linked to another account.',
  channel_mismatch:
    'This account is already linked to a different channel. Sign in with the account that owns it.',
  sign_in_failed: 'Sign-in failed. Please try again.',
};

export function loginErrorMessage(code: string | null, detail: string | null): string {
  if (!code) return '';
  const parsed = LoginErrorCodeSchema.safeParse(code);
  // Unknown or legacy free text: say something generic rather than echo it.
  if (!parsed.success) return COPY.sign_in_failed;

  switch (parsed.data) {
    case 'provider_denied':
      return detail ? `${COPY.provider_denied} (${detail})` : COPY.provider_denied;
    case 'channel_claimed':
      return detail ? `${detail} is already linked to another account.` : COPY.channel_claimed;
    default:
      return COPY[parsed.data];
  }
}
