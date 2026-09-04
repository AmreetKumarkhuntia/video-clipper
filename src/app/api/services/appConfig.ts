import { config } from '@lib/config/index.js';
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
  return {
    clientId: cfg.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: cfg.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: cfg.GOOGLE_OAUTH_REDIRECT_URI,
  };
}

/** Session lifetime, in the milliseconds the orchestrator works in. */
export function sessionTtlMs(cfg: Config): number {
  return cfg.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/** Assembles the OAuth client config the publish service expects from full Config. */
export function toYouTubeOAuthConfig(cfg: Config): YouTubeOAuthClientConfig {
  return {
    clientId: cfg.YOUTUBE_OAUTH_CLIENT_ID,
    clientSecret: cfg.YOUTUBE_OAUTH_CLIENT_SECRET,
    redirectUri: cfg.YOUTUBE_OAUTH_REDIRECT_URI,
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
