import { promises as fs } from 'fs';
import { parseUrl, extractMetadata } from '@lib/services/video/index.js';
import { runAnalysis } from '@lib/orchestration/analysisOrchestrator.js';
import { generateClipsForAnalysis } from '@lib/orchestration/clipOrchestrator.js';
import { upsertVideo } from '@lib/services/db/index.js';
import { config } from '@lib/config/index.js';
import { log } from '@lib/utils/logger.js';
import { formatConfig, formatSeconds } from '@lib/utils/format.js';
import { parseArgs, printUsage } from '../args.js';
import { printAnalysisSummary, printClipResults } from '../output/formatter.js';
import { createAnalysisCallbacks } from '../output/progress.js';
import type { YtDlpCookies } from '@lib/types/downloader.js';
import type { CreateAnalysisRequest, CreateClipsRequest } from '@lib/types/analysis.js';
import type { CommandHandler } from '@lib/types/command.js';

async function run(argv: string[], requestId: string): Promise<void> {
  const args = parseArgs(['_', '_', ...argv]);

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.url) {
    log.error('run', 'No YouTube URL provided.', requestId);
    printUsage();
    process.exit(1);
  }

  if (args.noAudio || args.gameProfile) {
    log.warn(
      'run',
      'The --no-audio and --game-profile flags are deprecated and ignored: the run command no longer performs audio event detection.',
      requestId,
    );
  }

  log.info(
    'run',
    `Starting video-clipper (model: ${config.LLM_MODEL})` +
      (args.clip ? ' [--clip enabled]' : '') +
      (args.localVideo ? ` [--local-video: ${args.localVideo}]` : ''),
    requestId,
  );
  log.info('run', `Config: ${formatConfig(config)}`, requestId);

  const cookies: YtDlpCookies = {
    cookiesFromBrowser: config.YT_DLP_COOKIES_FROM_BROWSER,
    cookiesFile: config.YT_DLP_COOKIES_FILE,
    quiet: config.YT_DLP_QUIET,
    retryCount: config.YT_DLP_RETRY_COUNT,
  };

  let videoId: string;
  try {
    videoId = parseUrl(args.url);
  } catch {
    throw new Error(`Invalid YouTube URL: ${args.url}`);
  }

  log.info('run', `Fetching metadata for ${videoId}...`, requestId);
  const metadata = await extractMetadata(videoId, cookies);
  log.info(
    'run',
    `Video: "${metadata.title}" (${metadata.duration > 0 ? formatSeconds(metadata.duration) : 'duration unknown'})`,
    requestId,
  );

  if (args.maxDuration && metadata.duration > 0 && metadata.duration > args.maxDuration) {
    throw new Error(
      `Video duration exceeds --max-duration limit. ` +
        `(${formatSeconds(metadata.duration)} > ${formatSeconds(args.maxDuration)})`,
    );
  }

  upsertVideo({
    id: videoId,
    channelId: '',
    title: metadata.title,
    description: '',
    channelTitle: '',
    publishedAt: '',
    durationSec: metadata.duration,
    tags: [],
  });

  const analysisInput: CreateAnalysisRequest = {
    videoId,
    title: metadata.title,
    durationSec: metadata.duration,
    options: {
      maxChunks: args.maxChunks,
      maxParallel: args.maxParallel,
      noCache: args.noCache,
      noSegmentCache: false,
      threshold: args.threshold,
      topN: args.topN,
      refine: true,
    },
  };

  const abortController = new AbortController();
  process.on('SIGINT', () => {
    log.warn('run', 'Received SIGINT — aborting...', requestId);
    abortController.abort();
  });

  const chunkCount = args.maxChunks ?? config.MAX_CHUNKS ?? 0;
  const callbacks = createAnalysisCallbacks(chunkCount, requestId);

  log.info('run', `Starting analysis (model: ${config.LLM_MODEL})...`, requestId);
  const plan = await runAnalysis(
    analysisInput,
    config,
    callbacks,
    requestId,
    abortController.signal,
  );
  printAnalysisSummary(plan);

  if (args.outputJson) {
    await fs.writeFile(args.outputJson, JSON.stringify(plan, null, 2) + '\n', 'utf-8');
    log.info('run', `Wrote analysis JSON to ${args.outputJson}`, requestId);
  }

  if (!args.clip) return;

  if (plan.candidates.length === 0) {
    log.warn('run', 'No clip candidates found — skipping clip generation.', requestId);
    return;
  }

  const clipInput: CreateClipsRequest = {
    videoId: plan.videoId,
    analysisId: plan.id,
    segments: plan.candidates.map((c) => ({
      id: c.id,
      rank: c.rank,
      startSec: c.startSec,
      endSec: c.endSec,
      score: c.score,
      reason: c.reason,
      source: c.source,
      audioEvent: c.audioEvent,
    })),
    options: {
      localVideo: args.localVideo,
      videoPath: args.videoPath,
      downloadSections: args.downloadSections,
    },
  };

  log.info('run', `Generating ${plan.candidates.length} clips...`, requestId);
  const clips = await generateClipsForAnalysis(clipInput, config, requestId);
  printClipResults(clips);
}

export const runCommand: CommandHandler = {
  name: 'run',
  description: 'One-shot pipeline: analyze + clip in one command',
  usage: 'video-clipper run <youtube-url> [options]',
  run,
};
