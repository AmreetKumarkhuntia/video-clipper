import { basename } from 'path';
import { config } from '@lib/config/index.js';
import { exportClips } from '@lib/pipeline/stages/clipExporter.js';
import type { ClipExporterConfig } from '@lib/pipeline/stages/clipExporter.js';
import {
  createArtifactId,
  saveClipArtifacts,
} from '@app/web/lib/services/artifacts/artifactStore.js';
import type { ClipArtifact, CreateClipsRequest } from '@app/web/types/analysis.js';
import type { RankedSegment } from '@lib/types/index.js';
import type { YtDlpCookies } from '@lib/services/video/source/youtube/metadata.js';

export async function generateWebClips(input: CreateClipsRequest): Promise<ClipArtifact[]> {
  const cookies: YtDlpCookies = {
    cookiesFromBrowser: config.YT_DLP_COOKIES_FROM_BROWSER,
    cookiesFile: config.YT_DLP_COOKIES_FILE,
  };

  const exporterConfig: ClipExporterConfig = {
    downloader: {
      ...cookies,
      downloadDir: config.DOWNLOAD_DIR,
      timestampOffset: config.TIMESTAMP_OFFSET_SECONDS,
      llmConcurrency: config.LLM_CONCURRENCY,
    },
    clipper: {
      ffmpegPath: config.FFMPEG_PATH,
      ffprobePath: config.FFPROBE_PATH,
      timestampOffset: config.TIMESTAMP_OFFSET_SECONDS,
      ffmpegPreset: config.FFMPEG_PRESET,
      outputDir: config.OUTPUT_DIR,
    },
    downloadSectionsMode: config.DOWNLOAD_SECTIONS_MODE,
  };

  const segments = input.segments.map(toRankedSegment);
  const paths = await exportClips(
    input.videoId,
    segments,
    {
      downloadSections: 'all',
      clipConcurrency: config.CLIP_CONCURRENCY,
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

  return saveClipArtifacts(artifacts, config.OUTPUT_DIR);
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
