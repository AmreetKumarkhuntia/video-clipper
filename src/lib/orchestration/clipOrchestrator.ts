import { basename } from 'path';
import { promises as fs } from 'fs';
import { exportClips } from '@lib/pipeline/stages/clipExporter.js';
import type { ClipExporterConfig } from '@lib/pipeline/stages/clipExporter.js';
import {
  getClipRow,
  upsertClip,
  listClipsByAnalysisId,
  deleteClipsByAnalysisId,
} from '@lib/services/db/repos/clipsRepo.js';
import type { ClipArtifact, CreateClipsRequest } from '@lib/types/analysis.js';
import type { RankedSegment } from '@lib/types/index.js';
import type { YtDlpCookies } from '@lib/services/video/source/youtube/metadata.js';
import type { Config } from '@lib/types/config.js';
import { log } from '@lib/utils/logger.js';

export async function generateClipsForAnalysis(
  input: CreateClipsRequest,
  cfg: Config,
  requestId?: string,
): Promise<ClipArtifact[]> {
  const downloadMode = cfg.PARTIAL_DOWNLOAD_ENABLED ? input.segments.length : 'all';
  log.info(
    'generateClips',
    `[clips] [request] | analysisId=${input.analysisId} videoId=${input.videoId} segments=${input.segments.length} downloadSections=${downloadMode} concurrency=${cfg.CLIP_CONCURRENCY}`,
    requestId,
  );

  const cookies: YtDlpCookies = {
    cookiesFromBrowser: cfg.YT_DLP_COOKIES_FROM_BROWSER,
    cookiesFile: cfg.YT_DLP_COOKIES_FILE,
    quiet: cfg.YT_DLP_QUIET,
    retryCount: cfg.YT_DLP_RETRY_COUNT,
    segmentCookiesEnabled: cfg.YT_DLP_SEGMENT_COOKIES_ENABLED,
    playerClient: cfg.YT_DLP_PLAYER_CLIENT,
    noCheckCertificates: cfg.YT_DLP_NO_CHECK_CERTIFICATES,
    forceIpv4: cfg.YT_DLP_FORCE_IPV4,
    geoBypass: cfg.YT_DLP_GEO_BYPASS,
    sleepRequests: cfg.YT_DLP_SLEEP_REQUESTS,
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

  const existing = input.analysisId ? listClipsByAnalysisId(input.analysisId) : [];

  const segments = input.segments.map(toRankedSegment);
  const paths = await exportClips(
    input.videoId,
    segments,
    {
      downloadSections: cfg.PARTIAL_DOWNLOAD_ENABLED ? segments.length : 'all',
      clipConcurrency: cfg.CLIP_CONCURRENCY,
    },
    exporterConfig,
  );

  const saved = paths.map((path, index) => {
    const source = input.segments[index];
    return upsertClip({
      id: `clip-${input.videoId}-${source.id}`,
      videoId: input.videoId,
      analysisId: input.analysisId,
      segmentationId: source.id,
      segmentRank: source.rank,
      filename: basename(path),
      path,
      startSec: source.startSec,
      endSec: source.endSec,
      durationSec: Math.max(0.01, source.endSec - source.startSec),
    });
  });

  log.info(
    'generateClips',
    `[clips] [generated] | analysisId=${input.analysisId} requested=${input.segments.length} created=${saved.length}`,
    requestId,
  );

  const keepIds = saved.map((artifact) => artifact.id);
  const staleIds = existing
    .filter((artifact) => !keepIds.includes(artifact.id))
    .map((artifact) => artifact.id);

  if (staleIds.length > 0) {
    await Promise.all(
      staleIds.map(async (id) => {
        const row = getClipRow(id);
        if (!row) return;
        for (const filePath of [row.path, row.editedPath].filter(Boolean) as string[]) {
          await fs.unlink(filePath).catch((e: NodeJS.ErrnoException) => {
            if (e.code !== 'ENOENT')
              log.warn('generateClips', `unlink failed: ${filePath}`, requestId, {
                error: String(e),
              });
          });
        }
      }),
    );
    if (input.analysisId) {
      deleteClipsByAnalysisId(input.analysisId, keepIds);
    }
    log.info(
      'generateClips',
      `[clips] [pruned] | analysisId=${input.analysisId} stale=${staleIds.length}`,
      requestId,
    );
  }

  return saved;
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
