import { getWebServerConfig } from '@app/web/lib/services/config/webConfig.js';
import { GoogleYouTubeCatalogService } from '@lib/services/video/source/youtube/catalog.js';
import type { YouTubeCatalogService } from '@lib/types/youtube.js';

export function createYouTubeCatalogService(): YouTubeCatalogService {
  const webConfig = getWebServerConfig();

  if (!webConfig.youtubeApiKey || webConfig.youtubeApiKey.trim() === '') {
    throw new Error('YOUTUBE_API_KEY is required to browse YouTube channels and videos.');
  }

  return new GoogleYouTubeCatalogService(webConfig.youtubeApiKey);
}
