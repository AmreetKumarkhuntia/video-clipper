/**
 * The parse itself lives in `@lib/utils/youtubeUrl` so the apps can reach it
 * without importing a domain service. This alias keeps the service's public
 * name, which the video barrel and the public API both export.
 */
export { parseVideoId as parseUrl } from '@lib/utils/youtubeUrl.js';
