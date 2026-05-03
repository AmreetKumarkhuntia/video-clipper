import { config } from '@lib/config/index.js';

export interface WebServerConfig {
  youtubeApiKey: string | undefined;
  outputDir: string;
  cacheDir: string;
  defaultThreshold: number;
  defaultTopN: number;
  defaultConcurrency: number;
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
