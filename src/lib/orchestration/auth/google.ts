import {
  buildGoogleAuthUrl,
  createCodeVerifier,
  createOAuthState,
  exchangeGoogleCode,
  expiryFromExpiresIn,
  fetchGoogleUserInfo,
  fetchOwnedYouTubeChannel,
} from '@lib/utils/googleOAuth.js';
import { BaseOAuthProvider } from './base.js';
import type {
  AuthProvider,
  GoogleOAuthClientConfig,
  OAuthHandshake,
  OAuthLoginStart,
  ProviderAccount,
} from '@lib/types/auth.js';

/**
 * Google, and through it the YouTube channel the account owns.
 *
 * Everything Google-shaped stops here: the base class never sees a `sub`, an
 * `expires_in`, or a channels API response.
 */
export class GoogleOAuthProvider extends BaseOAuthProvider {
  readonly id: AuthProvider = 'google';

  constructor(private readonly oauth: GoogleOAuthClientConfig) {
    super();
  }

  startLogin(returnTo: string): OAuthLoginStart {
    const handshake: OAuthHandshake = {
      state: createOAuthState(),
      codeVerifier: createCodeVerifier(),
      returnTo,
    };
    return {
      authUrl: buildGoogleAuthUrl(this.oauth, handshake.state, handshake.codeVerifier),
      handshake,
    };
  }

  protected async fetchAccount(code: string, handshake: OAuthHandshake): Promise<ProviderAccount> {
    const tokens = await exchangeGoogleCode(code, handshake.codeVerifier, this.oauth);
    const [profile, channel] = await Promise.all([
      fetchGoogleUserInfo(tokens.access_token),
      fetchOwnedYouTubeChannel(tokens.access_token),
    ]);

    // A YouTube rule, not an OAuth one, so it belongs to this provider: the
    // product has nothing to show someone with no channel.
    if (!channel) {
      throw new Error(
        'This Google account has no YouTube channel. Sign in with the account that owns your channel.',
      );
    }

    const expiryDate = expiryFromExpiresIn(tokens.expires_in);
    return {
      accountId: profile.sub,
      ...(profile.email ? { email: profile.email } : {}),
      ...(profile.name ? { name: profile.name } : {}),
      ...(profile.picture ? { avatarUrl: profile.picture } : {}),
      channel: { id: channel.channelId, title: channel.title },
      tokens: {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        ...(expiryDate !== undefined ? { expiryDate } : {}),
        ...(tokens.scope ? { scope: tokens.scope } : {}),
      },
      metadata: {
        ...(channel.uploadsPlaylistId ? { uploadsPlaylistId: channel.uploadsPlaylistId } : {}),
        ...(channel.thumbnailUrl ? { channelThumbnailUrl: channel.thumbnailUrl } : {}),
      },
    };
  }
}
