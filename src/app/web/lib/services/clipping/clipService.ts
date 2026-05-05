import { basename } from 'path';
import { exportClips } from '@lib/pipeline/stages/clipExporter.js';
import type { ClipExporterConfig } from '@lib/pipeline/stages/clipExporter.js';
import {
  createArtifactId,
  saveClipArtifacts,
} from '@app/web/lib/services/artifacts/artifactStore.js';
import type { ClipArtifact, CreateClipsRequest } from '@app/web/types/analysis.js';
import type { RankedSegment } from '@lib/types/index.js';
import type { YtDlpCookies } from '@lib/services/video/source/youtube/metadata.js';
import type { Config } from '@lib/types/config.js';

export async function generateWebClips(
  input: CreateClipsRequest,
  cfg: Config,
): Promise<ClipArtifact[]> {
  const cookies: YtDlpCookies = {
    cookiesFromBrowser: cfg.YT_DLP_COOKIES_FROM_BROWSER,
    cookiesFile: cfg.YT_DLP_COOKIES_FILE,
  };

  const exporterConfig: ClipExporterConfig = {
    downloader: {
      ...cookies,
      downloadDir: cfg.DOWNLOAD_DIR,
      timestampOffset: cfg.TIMESTAMP_OFFSET_SECONDS,
      llmConcurrency: cfg.LLM_CONCURRENCY,
    },
    clipper: {
      ffmpegPath: cfg.FFMPEG_PATH,
      ffprobePath: cfg.FFPROBE_PATH,
      timestampOffset: cfg.TIMESTAMP_OFFSET_SECONDS,
      ffmpegPreset: cfg.FFMPEG_PRESET,
      outputDir: cfg.OUTPUT_DIR,
    },
    downloadSectionsMode: cfg.DOWNLOAD_SECTIONS_MODE,
  };

  const segments = input.segments.map(toRankedSegment);
  const paths = await exportClips(
    input.videoId,
    segments,
    {
      downloadSections: 'all',
      clipConcurrency: cfg.CLIP_CONCURRENCY,
    },
    exporterConfig,
  );
  const createdAt = new Date().toISOString();

  const artifacts = paths.map((path, index) => {
    const source = input.segments[index];
    const startSec = source.startSec;
    const endSec = source.endSec;

    return {
      id: createArtifactId(`clip-${input.videoId}`),
      videoId: input.videoId,
      analysisId: input.analysisId,
      segmentId: source.id,
      filename: basename(path),
      path,
      startSec,
      endSec,
      durationSec: Math.max(0.01, endSec - startSec),
      createdAt,
    };
  });

  return saveClipArtifacts(artifacts, cfg.OUTPUT_DIR);
}

function toRankedSegment(segment: CreateClipsRequest['segments'][number]): RankedSegment {
  return {
    rank: segment.rank,
    start: segment.startSec,
    end: segment.endSec,
    score: segment.score,
    reason: segment.reason,
    source: segment.source,
    audio_event: segment.audioEvent,
  };
}
