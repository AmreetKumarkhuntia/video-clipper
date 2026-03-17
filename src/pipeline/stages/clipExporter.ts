import { downloadVideo } from '../../services/videoDownloader/index.js';
import { generateClips, organizeClips } from '../../services/clipGenerator/index.js';
import { log } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import type { RankedSegment, ClipExporterOpts } from '../../types/index.js';

export type { ClipExporterOpts };

/**
 * Stage 6 — Clip Exporter
 *
 * Handles all three clip-generation modes:
 *   1. Local video  — user supplied --local-video; run ffmpeg directly
 *   2. Segments     -- --download-sections N; download top-N clips via yt-dlp
 *                      --download-sections, then copy to outputs/
 *   3. Full video   — download full video with yt-dlp, then cut clips with ffmpeg
 *
 * @returns Array of absolute paths to the generated clip files.
 */
export async function exportClips(
  videoId: string,
  segments: RankedSegment[],
  opts: ClipExporterOpts,
): Promise<string[]> {
  // Mode 1: local video already on disk — cut with ffmpeg
  if (opts.localVideo) {
    log.info(`Using local video: ${opts.localVideo}`);
    return generateClips(
      opts.localVideo,
      segments,
      videoId,
      opts.videoPath,
      config.CLIP_CONCURRENCY,
    );
  }

  // Determine yt-dlp mode
  const downloadSections = opts.downloadSections ?? config.DOWNLOAD_SECTIONS_MODE;

  if (typeof downloadSections === 'number') {
    // Mode 2: download only the top-N segments via --download-sections
    const segmentsToDownload = segments.slice(0, downloadSections);

    if (segmentsToDownload.length < downloadSections) {
      log.warn(
        `Requested ${downloadSections} segments, but only ${segmentsToDownload.length} are available above threshold.`,
      );
    }

    log.info(`Downloading ${segmentsToDownload.length} segments via yt-dlp --download-sections...`);
    const downloadResult = await downloadVideo(
      videoId,
      'segments',
      segmentsToDownload,
      opts.videoPath,
    );

    if (downloadResult.mode !== 'segments') {
      throw new Error('Expected segments download result but got full-video result.');
    }

    return organizeClips(downloadResult.paths, videoId, opts.videoPath, config.CLIP_CONCURRENCY);
  }

  // Mode 3: full-video download → cut clips with ffmpeg
  log.info('Downloading full video via yt-dlp...');
  const downloadResult = await downloadVideo(videoId, 'all', [], opts.videoPath);

  if (downloadResult.mode !== 'all') {
    throw new Error('Expected full-video download result but got segments result.');
  }

  return generateClips(
    downloadResult.path,
    segments,
    videoId,
    opts.videoPath,
    config.CLIP_CONCURRENCY,
  );
}
