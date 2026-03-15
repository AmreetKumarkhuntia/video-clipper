import { execa } from 'execa';
import { promises as fs } from 'fs';
import { join } from 'path';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';

/**
 * Downloads a YouTube video using yt-dlp and returns the local file path.
 *
 * Strategy:
 * - Skips download if the target file already exists.
 * - Auto-creates the download directory if it doesn't exist.
 * - Surfaces clear errors for common failure modes (yt-dlp not installed,
 *   private/geo-blocked video, etc.).
 *
 * @param videoId - 11-character YouTube video ID
 * @returns Absolute path to the downloaded mp4 file
 * @throws {Error} if yt-dlp is not installed or the download fails
 */
export async function downloadVideo(videoId: string): Promise<string> {
  await fs.mkdir(config.DOWNLOAD_DIR, { recursive: true });

  const outputPath = join(config.DOWNLOAD_DIR, `${videoId}.mp4`);

  // Skip re-download if file already exists
  try {
    await fs.access(outputPath);
    log.info(`Video already downloaded: ${outputPath}`);
    return outputPath;
  } catch {
    // File does not exist — proceed with download
  }

  log.info(`Downloading video ${videoId} via yt-dlp...`);

  try {
    await execa('yt-dlp', [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
      '--merge-output-format', 'mp4',
      '-o', outputPath,
      '--no-playlist',
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('command not found') || message.includes('ENOENT')) {
      throw new Error(
        'yt-dlp is not installed or not in PATH. Install it: https://github.com/yt-dlp/yt-dlp#installation'
      );
    }

    if (message.includes('Private video') || message.includes('Sign in')) {
      throw new Error(`Video "${videoId}" is private and cannot be downloaded.`);
    }

    if (message.includes('not available in your country') || message.includes('geo')) {
      throw new Error(`Video "${videoId}" is geo-blocked in your region.`);
    }

    throw new Error(`yt-dlp download failed for "${videoId}": ${message}`);
  }

  log.info(`Download complete: ${outputPath}`);
  return outputPath;
}
