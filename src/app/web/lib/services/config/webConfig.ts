import { config } from '@lib/config/index.js';
import type { Config } from '@lib/types/config.js';
import type { YouTubeOAuthClientConfig } from '@lib/types/publish.js';
import type { WebServerConfig } from '@app/web/types/web.js';

export type { WebServerConfig };

/** Assembles the OAuth client config the publish service expects from full Config. */
export function toYouTubeOAuthConfig(cfg: Config): YouTubeOAuthClientConfig {
  return {
    clientId: cfg.YOUTUBE_OAUTH_CLIENT_ID,
    clientSecret: cfg.YOUTUBE_OAUTH_CLIENT_SECRET,
    redirectUri: cfg.YOUTUBE_OAUTH_REDIRECT_URI,
  };
}

export function getWebServerConfig(): WebServerConfig {
  return {
    youtubeApiKey: config.YOUTUBE_API_KEY,
    outputDir: config.OUTPUT_DIR,
    cacheDir: config.CACHE_DIR,
    defaultThreshold: config.SCORE_THRESHOLD,
    defaultTopN: config.TOP_N_SEGMENTS,
    defaultConcurrency: config.LLM_CONCURRENCY,
  };
}
