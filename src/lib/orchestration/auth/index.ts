import { GoogleOAuthProvider } from './google.js';
import type { AuthProvider, GoogleOAuthClientConfig } from '@lib/types/auth.js';
import type { BaseOAuthProvider } from './base.js';

export { BaseOAuthProvider, resolveSession, signOut } from './base.js';
export { GoogleOAuthProvider } from './google.js';

/**
 * Builds the provider a sign-in route should drive.
 *
 * The route names a provider and hands over its client config; it never
 * constructs a concrete class, so adding one is a change here and nowhere else.
 */
export function oauthProvider(
  provider: AuthProvider,
  oauth: GoogleOAuthClientConfig,
): BaseOAuthProvider {
  switch (provider) {
    case 'google':
      return new GoogleOAuthProvider(oauth);
  }
}
