import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import { join } from 'path';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';
import type { RankedSegment } from '../../types/index.js';

/**
 * Cuts a single clip from a video file using fluent-ffmpeg.
 * Uses `-c copy` to avoid re-encoding (fast, lossless cut).
 *
 * @returns The output file path on success
 * @throws {Error} if ffmpeg fails
 */
function cutClip(
  videoPath: string,
  start: number,
  end: number,
  outputPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .setStartTime(start)
      .setDuration(end - start)
      .outputOptions('-c copy')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err: Error) => reject(err))
      .run();
  });
}

/**
 * Generates video clips for each ranked segment using fluent-ffmpeg.
 *
 * - Auto-creates the output directory if it doesn't exist.
 * - Runs all clips in parallel via Promise.allSettled.
 * - Logs a warning per failed clip; never aborts the entire run.
 * - Uses `-c copy` (stream copy, no re-encoding) for speed.
 *
 * @param videoPath - Local path to the downloaded mp4
 * @param segments  - Ranked segments to cut
 * @param videoId   - Used to name output files
 * @returns Array of successfully written clip file paths
 * @throws {Error} if ffmpeg is not installed
 */
export async function generateClips(
  videoPath: string,
  segments: RankedSegment[],
  videoId: string
): Promise<string[]> {
  await fs.mkdir(config.OUTPUT_DIR, { recursive: true });

  if (segments.length === 0) {
    log.warn('No segments provided to generateClips — nothing to cut.');
    return [];
  }

  // Verify ffmpeg is reachable before spinning up parallel jobs
  await verifyFfmpeg();

  const jobs = segments.map(async (segment) => {
    const startInt = Math.floor(segment.start);
    const endInt = Math.ceil(segment.end);
    const outputPath = join(config.OUTPUT_DIR, `${videoId}_${startInt}_${endInt}.mp4`);

    log.info(`Cutting clip: ${outputPath} (${startInt}s – ${endInt}s)`);
    return cutClip(videoPath, segment.start, segment.end, outputPath);
  });

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
        `Failed to cut clip for segment [${segment.start}s – ${segment.end}s] (rank ${segment.rank}): ${reason}`
      );
    }
  }

  return paths;
}

/**
 * Probes ffmpeg availability by running `ffmpeg -version`.
 * @throws {Error} with an actionable install message if ffmpeg is not found
 */
async function verifyFfmpeg(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg.getAvailableFormats((err) => {
      if (err) {
        reject(
          new Error(
            'ffmpeg is required for clip generation but was not found in PATH. ' +
              'Install it: https://ffmpeg.org/download.html'
          )
        );
      } else {
        resolve();
      }
    });
  });
}
