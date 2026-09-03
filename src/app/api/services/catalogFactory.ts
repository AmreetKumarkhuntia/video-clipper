import { getApiServerConfig } from './appConfig.js';
import { GoogleYouTubeCatalogService } from '@lib/services/video/index.js';
import type { YouTubeCatalogService } from '@lib/types/youtube.js';

export function createYouTubeCatalogService(): YouTubeCatalogService {
  const cfg = getApiServerConfig();

  if (!cfg.youtubeApiKey || cfg.youtubeApiKey.trim() === '') {
    throw new Error('YOUTUBE_API_KEY is required to browse YouTube channels and videos.');
  }

  return new GoogleYouTubeCatalogService(cfg.youtubeApiKey);
}
