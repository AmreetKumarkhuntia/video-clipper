import { execa } from 'execa';
import { promises as fs } from 'fs';
import { join } from 'path';
import pLimit from 'p-limit';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';
import type { RankedSegment, DownloadMode, DownloadResult } from '../../types/index.js';

/**
 * Formats a timestamp for yt-dlp --download-sections.
 * Converts seconds to HH:MM:SS.mmm format with millisecond precision.
 */
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const sInt = Math.floor(s);
  const ms = Math.round((s - sInt) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sInt).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Displays progress from yt-dlp stdout/stderr.
 */
function displayProgress(stream: 'stdout' | 'stderr'): (data: Buffer | string) => void {
  return (data: Buffer | string) => {
    const text = String(data);
    const lines = text.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*%)/);
      if (progressMatch) {
        process.stdout.write(`\r${progressMatch[0]}`);
      }
    }
  };
}

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
 * @param customPath - Custom output directory (optional, overrides DOWNLOAD_DIR)
 * @returns Absolute path to the downloaded mp4 file
 * @throws {Error} if yt-dlp is not installed or the download fails
 */
export async function downloadFullVideo(videoId: string, customPath?: string): Promise<string> {
  const downloadDir = customPath || config.DOWNLOAD_DIR;
  await fs.mkdir(downloadDir, { recursive: true });

  const outputPath = join(downloadDir, `${videoId}.mp4`);

  try {
    await fs.access(outputPath);
    log.info(`Video already downloaded: ${outputPath}`);
    return outputPath;
  } catch {}

  log.info(`Downloading full video ${videoId} via yt-dlp...`);

  try {
    const args = [
      '-f',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
      '--merge-output-format',
      'mp4',
      '-o',
      outputPath,
      '--no-playlist',
      '--newline',
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    if (config.YT_DLP_COOKIES_FROM_BROWSER) {
      args.splice(0, 0, '--cookies-from-browser', config.YT_DLP_COOKIES_FROM_BROWSER);
    } else if (config.YT_DLP_COOKIES_FILE) {
      args.splice(0, 0, '--cookies', config.YT_DLP_COOKIES_FILE);
    }

    const subprocess = execa('yt-dlp', args);

    subprocess.stdout?.on('data', displayProgress('stdout'));
    subprocess.stderr?.on('data', displayProgress('stderr'));

    await subprocess;
    process.stdout.write('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('command not found') || message.includes('ENOENT')) {
      throw new Error('yt-dlp is required. Install it: https://github.com/yt-dlp/yt-dlp');
    }

    if (message.includes('Private video') || message.includes('Sign in')) {
      throw new Error(`Video "${videoId}" is private and cannot be downloaded.`);
    }

    if (message.includes('not available in your country') || message.includes('geo')) {
      throw new Error(`Video "${videoId}" is geo-blocked in your region.`);
    }

    throw new Error(`Download failed: ${message}`);
  }

  log.info(`Download complete: ${outputPath}`);
  return outputPath;
}

/**
 * Downloads a single segment using yt-dlp --download-sections.
 */
async function downloadSegment(
  videoId: string,
  segment: RankedSegment,
  index: number,
  customPath?: string,
): Promise<string> {
  const downloadDir = customPath || config.DOWNLOAD_DIR;
  await fs.mkdir(downloadDir, { recursive: true });

  const adjustedStart = Math.max(0, segment.start + config.TIMESTAMP_OFFSET_SECONDS);
  const adjustedEnd = Math.max(adjustedStart + 1, segment.end + config.TIMESTAMP_OFFSET_SECONDS);
  const startInt = Math.floor(adjustedStart);
  const endInt = Math.ceil(adjustedEnd);
  const outputPath = join(downloadDir, `${videoId}_${startInt}_${endInt}.mp4`);

  try {
    await fs.access(outputPath);
    log.info(`Segment ${index + 1}/${index} already downloaded: ${outputPath}`);
    return outputPath;
  } catch {}

  const startTs = formatTimestamp(adjustedStart);
  const endTs = formatTimestamp(adjustedEnd);

  log.info(`Downloading segment ${index + 1}: ${startTs} - ${endTs} (${segment.reason})`);
  log.info(`  Requested: ${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s`);
  if (config.TIMESTAMP_OFFSET_SECONDS !== 0) {
    log.info(
      `  Adjusted: ${adjustedStart.toFixed(2)}s - ${adjustedEnd.toFixed(2)}s (offset: ${config.TIMESTAMP_OFFSET_SECONDS}s)`,
    );
  }

  try {
    const args = [
      '-f',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
      '--merge-output-format',
      'mp4',
      '--download-sections',
      `*${startTs}-${endTs}`,
      '-o',
      outputPath,
      '--no-playlist',
      '--newline',
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    if (config.YT_DLP_COOKIES_FROM_BROWSER) {
      args.splice(0, 0, '--cookies-from-browser', config.YT_DLP_COOKIES_FROM_BROWSER);
    } else if (config.YT_DLP_COOKIES_FILE) {
      args.splice(0, 0, '--cookies', config.YT_DLP_COOKIES_FILE);
    }

    const subprocess = execa('yt-dlp', args);

    subprocess.stdout?.on('data', displayProgress('stdout'));
    subprocess.stderr?.on('data', displayProgress('stderr'));

    await subprocess;
    process.stdout.write('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('command not found') || message.includes('ENOENT')) {
      throw new Error('yt-dlp is required. Install it: https://github.com/yt-dlp/yt-dlp');
    }

    if (message.includes('Private video') || message.includes('Sign in')) {
      throw new Error(`Video "${videoId}" is private and cannot be downloaded.`);
    }

    if (message.includes('not available in your country') || message.includes('geo')) {
      throw new Error(`Video "${videoId}" is geo-blocked in your region.`);
    }

    throw new Error(`Segment download failed: ${message}`);
  }

  log.info(`Segment complete: ${outputPath}`);
  return outputPath;
}

/**
 * Downloads multiple segments in parallel.
 */
async function downloadSegments(
  videoId: string,
  segments: RankedSegment[],
  customPath?: string,
): Promise<string[]> {
  if (segments.length === 0) {
    return [];
  }

  const limit = pLimit(Math.min(config.LLM_CONCURRENCY, 3));
  const results: Array<PromiseSettledResult<string>> = await Promise.allSettled(
    segments.map((segment, index) =>
      limit(() => downloadSegment(videoId, segment, index, customPath)),
    ),
  );

  const paths: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const segment = segments[i];
    if (result.status === 'fulfilled') {
      paths.push(result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      log.warn(
        `Failed to download segment [${formatTimestamp(segment.start)} – ${formatTimestamp(segment.end)}] (rank ${segment.rank}): ${reason}`,
      );
    }
  }

  return paths;
}

/**
 * Downloads a YouTube video based on the specified mode.
 *
 * @param videoId - 11-character YouTube video ID
 * @param mode - Download mode: 'all' (full video) or 'segments' (individual clips)
 * @param segments - Ranked segments (required when mode is 'segments')
 * @param customPath - Custom output directory (optional, overrides config defaults)
 * @returns Download result containing the mode and either path or paths
 */
export async function downloadVideo(
  videoId: string,
  mode: DownloadMode = 'all',
  segments: RankedSegment[] = [],
  customPath?: string,
): Promise<DownloadResult> {
  if (mode === 'all') {
    const path = await downloadFullVideo(videoId, customPath);
    return { mode: 'all', path };
  }

  if (mode === 'segments') {
    if (segments.length === 0) {
      log.warn('No segments provided for download-segments mode. Skipping download.');
      return { mode: 'segments', paths: [] };
    }

    log.info(`Downloading ${segments.length} segments in parallel...`);
    const paths = await downloadSegments(videoId, segments, customPath);
    return { mode: 'segments', paths };
  }

  throw new Error(`Invalid download mode: ${mode}`);
}
