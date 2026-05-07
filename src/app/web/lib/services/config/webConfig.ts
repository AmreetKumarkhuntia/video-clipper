import { config } from '@lib/config/index.js';
import type { WebServerConfig } from '@app/web/types/web.js';

export type { WebServerConfig };

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
