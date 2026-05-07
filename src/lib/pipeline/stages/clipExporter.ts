import { downloadVideo } from '@lib/services/video/source/youtube/downloader.js';
import type { DownloaderConfig } from '@lib/types/downloader.js';
import { generateClips, organizeClips, remuxClips } from '@lib/services/video/clipper/index.js';
import type { ClipperConfig } from '@lib/types/video.js';
import { log } from '@lib/utils/logger.js';
import type { RankedSegment, ClipExporterOpts } from '@lib/types/index.js';
import type { ClipExporterConfig } from '@lib/types/pipeline.js';

export type { ClipExporterConfig } from '@lib/types/pipeline.js';

export async function exportClips(
  videoId: string,
  segments: RankedSegment[],
  opts: ClipExporterOpts,
  exporterConfig: ClipExporterConfig,
): Promise<string[]> {
  const clipConcurrency = opts.clipConcurrency;

  if (opts.localVideo) {
    log.info(`Using local video: ${opts.localVideo}`);
    return generateClips(
      opts.localVideo,
      segments,
      videoId,
      exporterConfig.clipper,
      opts.videoPath,
      clipConcurrency,
    );
  }

  const downloadSections = opts.downloadSections ?? exporterConfig.downloadSectionsMode;

  if (typeof downloadSections === 'number') {
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
      exporterConfig.downloader,
      opts.videoPath,
    );

    if (downloadResult.mode !== 'segments') {
      throw new Error('Expected segments download result but got full-video result.');
    }

    return remuxClips(
      downloadResult.paths,
      videoId,
      exporterConfig.clipper,
      opts.videoPath,
      clipConcurrency,
    );
  }

  log.info('Downloading full video via yt-dlp...');
  const downloadResult = await downloadVideo(
    videoId,
    'all',
    [],
    exporterConfig.downloader,
    opts.videoPath,
  );

  if (downloadResult.mode !== 'all') {
    throw new Error('Expected full-video download result but got segments result.');
  }

  return generateClips(
    downloadResult.path,
    segments,
    videoId,
    exporterConfig.clipper,
    opts.videoPath,
    clipConcurrency,
  );
}
