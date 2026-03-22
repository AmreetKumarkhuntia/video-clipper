import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import { join } from 'path';
import pLimit from 'p-limit';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';
import { formatSeconds } from '../../utils/format.js';
import type { RankedSegment } from '../../types/index.js';

if (config.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(config.FFMPEG_PATH);
}
if (config.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(config.FFPROBE_PATH);
}

/**
 * Cuts a single clip from a video file using fluent-ffmpeg.
 * Re-encodes with libx264 (video) and aac (audio) for perfect audio/video sync.
 *
 * @returns The output file path on success
 * @throws {Error} if ffmpeg fails
 */
function cutClip(
  videoPath: string,
  start: number,
  end: number,
  outputPath: string,
): Promise<string> {
  const adjustedStart = Math.max(0, start + config.TIMESTAMP_OFFSET_SECONDS);
  const adjustedEnd = Math.max(adjustedStart + 1, end + config.TIMESTAMP_OFFSET_SECONDS);
  const duration = adjustedEnd - adjustedStart;

  log.info(
    `Cutting clip: start=${adjustedStart.toFixed(2)}s, end=${adjustedEnd.toFixed(2)}s, duration=${duration.toFixed(2)}s`,
  );
  if (config.TIMESTAMP_OFFSET_SECONDS !== 0) {
    log.info(`  Timestamp offset applied: ${config.TIMESTAMP_OFFSET_SECONDS}s`);
  }

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .setStartTime(adjustedStart)
      .setDuration(duration)
      .outputOptions('-c:v', 'libx264')
      .outputOptions('-preset', config.FFMPEG_PRESET)
      .outputOptions('-c:a', 'aac')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err: Error) => reject(err))
      .run();
  });
}

/**
 * Copies a pre-downloaded segment file to the output directory.
 * Used when videos are downloaded via --download-sections segments mode.
 */
async function copySegment(
  sourcePath: string,
  outputPath: string,
  customPath?: string,
): Promise<string> {
  const outputDir = customPath || config.OUTPUT_DIR;
  const finalOutputPath = join(outputDir, outputPath.split('/').pop() || '');
  await fs.copyFile(sourcePath, finalOutputPath);
  return finalOutputPath;
}

/**
 * Generates video clips for each ranked segment using fluent-ffmpeg.
 *
 * - Auto-creates the output directory if it doesn't exist.
 * - Runs clips with controlled concurrency via p-limit.
 * - Logs a warning per failed clip; never aborts the entire run.
 * - Re-encodes with libx264/aac for accurate audio/video sync.
 *
 * @param videoPath - Local path to the downloaded mp4
 * @param segments - Ranked segments to cut
 * @param videoId - Used to name output files
 * @param customPath - Custom output directory (optional, overrides OUTPUT_DIR)
 * @param concurrency - Maximum number of parallel clip operations (default: 1)
 * @returns Array of successfully written clip file paths
 * @throws {Error} if ffmpeg is not installed
 */
export async function generateClips(
  videoPath: string,
  segments: RankedSegment[],
  videoId: string,
  customPath?: string,
  concurrency: number = 1,
): Promise<string[]> {
  const outputDir = customPath || config.OUTPUT_DIR;
  await fs.mkdir(outputDir, { recursive: true });

  if (segments.length === 0) {
    log.warn('No segments provided to generateClips — nothing to cut.');
    return [];
  }

  const limit = pLimit(concurrency);
  log.info(
    `Generating ${segments.length} clip${segments.length !== 1 ? 's' : ''} from local video (max ${concurrency} parallel)...`,
  );

  const jobs = segments.map((segment, i) =>
    limit(async () => {
      const startInt = Math.floor(segment.start);
      const endInt = Math.ceil(segment.end);
      const outputPath = join(outputDir, `${videoId}_${startInt}_${endInt}.mp4`);

      log.info(
        `Cutting clip: ${outputPath} (${formatSeconds(startInt)} – ${formatSeconds(endInt)})`,
      );
      return cutClip(videoPath, segment.start, segment.end, outputPath);
    }),
  );

  const results = await Promise.allSettled(jobs);

  const paths: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const segment = segments[i];
    if (result.status === 'fulfilled') {
      log.info(`Clip ready: ${result.value}`);
      paths.push(result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      log.warn(
        `Failed to cut clip for segment [${formatSeconds(segment.start)} – ${formatSeconds(segment.end)}] (rank ${segment.rank}): ${reason}`,
      );
    }
  }

  return paths;
}

/**
 * Organizes pre-downloaded segment files from downloads/ to outputs/.
 * Used when videos are downloaded via --download-sections segments mode.
 *
 * @param sourcePaths - Paths to the pre-downloaded segment files in downloads/
 * @param videoId - Used to verify file naming
 * @param customPath - Custom output directory (optional, overrides OUTPUT_DIR)
 * @param concurrency - Maximum number of parallel copy operations (default: 1)
 * @returns Array of organized clip file paths in outputs/
 */
export async function organizeClips(
  sourcePaths: string[],
  videoId: string,
  customPath?: string,
  concurrency: number = 1,
): Promise<string[]> {
  if (sourcePaths.length === 0) {
    log.warn('No pre-downloaded segments to organize.');
    return [];
  }

  const outputDir = customPath || config.OUTPUT_DIR;
  await fs.mkdir(outputDir, { recursive: true });

  const limit = pLimit(concurrency);
  log.info(
    `Organizing ${sourcePaths.length} clip${sourcePaths.length !== 1 ? 's' : ''} (max ${concurrency} parallel)...`,
  );

  const jobs = sourcePaths.map((sourcePath) =>
    limit(async () => {
      const filename = sourcePath.split('/').pop() || '';
      const outputPath = join(outputDir, filename);

      log.info(`Organizing clip: ${outputPath}`);
      return copySegment(sourcePath, outputPath, customPath);
    }),
  );

  const results = await Promise.allSettled(jobs);

  const paths: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      log.info(`Clip ready: ${result.value}`);
      paths.push(result.value);
    } else {
      const sourcePath = sourcePaths[i];
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      log.warn(`Failed to organize clip ${sourcePath}: ${reason}`);
    }
  }

  return paths;
}
