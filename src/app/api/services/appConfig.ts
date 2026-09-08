import { config, groupConfig } from '@lib/config/index.js';
import type { Config } from '@lib/types/config.js';
import type { GoogleOAuthClientConfig } from '@lib/types/auth.js';
import type { YouTubeOAuthClientConfig } from '@lib/types/publish.js';
import type { ApiServerConfig } from '@lib/types/api.js';

export type { ApiServerConfig };

/**
 * Sign-in's OAuth client. Separate from the publish client below: the two ask
 * for different scopes, and an operator may configure one without the other.
 */
export function toGoogleOAuthConfig(cfg: Config): GoogleOAuthClientConfig {
  const { GOOGLE } = groupConfig(cfg);
  return {
    clientId: GOOGLE.OAUTH_CLIENT_ID,
    clientSecret: GOOGLE.OAUTH_CLIENT_SECRET,
    redirectUri: GOOGLE.OAUTH_REDIRECT_URI,
  };
}

/** Session lifetime, in the milliseconds the orchestrator works in. */
export function sessionTtlMs(cfg: Config): number {
  return cfg.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/** Assembles the OAuth client config the publish service expects from full Config. */
export function toYouTubeOAuthConfig(cfg: Config): YouTubeOAuthClientConfig {
  const { YOUTUBE } = groupConfig(cfg);
  return {
    clientId: YOUTUBE.OAUTH_CLIENT_ID,
    clientSecret: YOUTUBE.OAUTH_CLIENT_SECRET,
    redirectUri: YOUTUBE.OAUTH_REDIRECT_URI,
  };
}

export function getApiServerConfig(): ApiServerConfig {
  return {
    youtubeApiKey: config.YOUTUBE_API_KEY,
    outputDir: config.OUTPUT_DIR,
    cacheDir: config.CACHE_DIR,
    defaultThreshold: config.SCORE_THRESHOLD,
    defaultTopN: config.TOP_N_SEGMENTS,
    defaultConcurrency: config.LLM_CONCURRENCY,
  };
}
