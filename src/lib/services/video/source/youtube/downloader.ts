import { execa } from 'execa';
import { promises as fs } from 'fs';
import { join } from 'path';
import pLimit from 'p-limit';
import { log } from '@lib/utils/logger.js';
import { retryAsync } from '@lib/utils/retryAsync.js';
import type { RankedSegment, DownloadMode, DownloadResult } from '@lib/types/index.js';
import type { DownloaderConfig } from '@lib/types/downloader.js';

export type { DownloaderConfig } from '@lib/types/downloader.js';

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
 * Builds yt-dlp flags that are shared across all download functions based on
 * the configurable strategy fields (player client, SSL, IPv4, geo-bypass,
 * sleep).  These flags are prepended/appended to the per-function arg list so
 * every call honours the same settings.
 */
function buildSharedFlags(dlConfig: DownloaderConfig): string[] {
  const flags: string[] = [];

  if (dlConfig.playerClient && dlConfig.playerClient !== 'auto') {
    flags.push('--extractor-args', `youtube:player_client=${dlConfig.playerClient}`);
  }

  if (dlConfig.noCheckCertificates) {
    flags.push('--no-check-certificates');
  }

  if (dlConfig.forceIpv4) {
    flags.push('--force-ipv4');
  }

  if (dlConfig.geoBypass) {
    flags.push('--geo-bypass');
  }

  if (dlConfig.sleepRequests && dlConfig.sleepRequests > 0) {
    flags.push('--sleep-requests', String(dlConfig.sleepRequests));
  }

  return flags;
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
export async function downloadFullVideo(
  videoId: string,
  dlConfig: DownloaderConfig,
  customPath?: string,
): Promise<string> {
  const downloadDir = customPath || dlConfig.downloadDir;
  await fs.mkdir(downloadDir, { recursive: true });

  const outputPath = join(downloadDir, `${videoId}.mp4`);

  try {
    await fs.access(outputPath);
    log.info(`Video already downloaded: ${outputPath}`);
    return outputPath;
  } catch {}

  log.info(`Downloading full video ${videoId} via yt-dlp...`);

  const args = [
    '-f',
    'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
    '--merge-output-format',
    'mp4',
    '-o',
    outputPath,
    '--no-playlist',
    '--newline',
    ...buildSharedFlags(dlConfig),
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  if (dlConfig.cookiesFromBrowser) {
    args.splice(0, 0, '--cookies-from-browser', dlConfig.cookiesFromBrowser);
  } else if (dlConfig.cookiesFile) {
    args.splice(0, 0, '--cookies', dlConfig.cookiesFile);
  }

  try {
    await retryAsync(
      async () => {
        const subprocess = execa('yt-dlp', args);
        if (!dlConfig.quiet) {
          subprocess.stdout?.on('data', log.progress);
          subprocess.stderr?.on('data', log.progress);
        }
        await subprocess;
      },
      dlConfig.retryCount ?? 0,
      2000,
      `yt-dlp:${videoId}`,
    );
    process.stdout.write('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Video download failed: ${String(err)}`);

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
  dlConfig: DownloaderConfig,
  customPath?: string,
): Promise<string> {
  const downloadDir = customPath || dlConfig.downloadDir;
  await fs.mkdir(downloadDir, { recursive: true });

  const adjustedStart = Math.max(0, segment.start + dlConfig.timestampOffset);
  const adjustedEnd = Math.max(adjustedStart + 1, segment.end + dlConfig.timestampOffset);
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
  if (dlConfig.timestampOffset !== 0) {
    log.info(
      `  Adjusted: ${adjustedStart.toFixed(2)}s - ${adjustedEnd.toFixed(2)}s (offset: ${dlConfig.timestampOffset}s)`,
    );
  }

  try {
    // NOTE: cookies are intentionally NOT passed here by default.
    //
    // When --cookies-from-browser or --cookies is present, yt-dlp is forced
    // into the TV + web_creator client path for --download-sections requests.
    // That path downloads tv-player-ias.js and attempts to solve the n-challenge
    // using it; the TV player JS references self.location.origin (a browser-only
    // global) which crashes in every non-browser JS runtime (Deno, Node.js).
    //
    // Without cookies, yt-dlp automatically selects the ANDROID_VR client.
    // The ANDROID_VR client generates pre-signed DASH URLs (c=ANDROID_VR)
    // that work even when n-challenge solving fails — so the download succeeds
    // at full quality (1080p60 DASH) for any public video.
    //
    // Trade-off: private or age-gated videos cannot be downloaded this way.
    // Enable YT_DLP_SEGMENT_COOKIES_ENABLED=true to pass cookies here — but
    // be aware it forces the TV client and may break public video downloads.
    // For those, set PARTIAL_DOWNLOAD_ENABLED=false and use the full-video path
    // which passes cookies and uses the web client (no TV player JS involved).
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
      ...buildSharedFlags(dlConfig),
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    if (dlConfig.segmentCookiesEnabled) {
      if (dlConfig.cookiesFromBrowser) {
        args.splice(0, 0, '--cookies-from-browser', dlConfig.cookiesFromBrowser);
      } else if (dlConfig.cookiesFile) {
        args.splice(0, 0, '--cookies', dlConfig.cookiesFile);
      }
    }

    await retryAsync(
      async () => {
        const subprocess = execa('yt-dlp', args);
        if (!dlConfig.quiet) {
          subprocess.stdout?.on('data', log.progress);
          subprocess.stderr?.on('data', log.progress);
        }
        await subprocess;
      },
      dlConfig.retryCount ?? 0,
      2000,
      `yt-dlp:${videoId}:seg${index + 1}`,
    );
    process.stdout.write('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Segment ${index + 1} download failed: ${String(err)}`);
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

async function downloadSegments(
  videoId: string,
  segments: RankedSegment[],
  dlConfig: DownloaderConfig,
  customPath?: string,
): Promise<string[]> {
  if (segments.length === 0) {
    return [];
  }

  const limit = pLimit(Math.min(dlConfig.llmConcurrency, 3));
  const results: Array<PromiseSettledResult<string>> = await Promise.allSettled(
    segments.map((segment, index) =>
      limit(() => downloadSegment(videoId, segment, index, dlConfig, customPath)),
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
  dlConfig: DownloaderConfig,
  customPath?: string,
): Promise<DownloadResult> {
  if (mode === 'all') {
    const path = await downloadFullVideo(videoId, dlConfig, customPath);
    return { mode: 'all', path };
  }

  if (mode === 'segments') {
    if (segments.length === 0) {
      log.warn('No segments provided for download-segments mode. Skipping download.');
      return { mode: 'segments', paths: [] };
    }

    log.info(`Downloading ${segments.length} segments in parallel...`);
    const paths = await downloadSegments(videoId, segments, dlConfig, customPath);
    return { mode: 'segments', paths };
  }

  throw new Error(`Invalid download mode: ${mode}`);
}
