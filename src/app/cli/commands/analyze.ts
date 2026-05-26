import { parseUrl } from '@lib/services/video/source/youtube/parser.js';
import { extractMetadata } from '@lib/services/video/source/youtube/metadata.js';
import { runAnalysis } from '@lib/orchestration/analysisOrchestrator.js';
import { upsertVideo } from '@lib/services/db/repos/videosRepo.js';
import { config } from '@lib/config/index.js';
import { log } from '@lib/utils/logger.js';
import { formatSeconds } from '@lib/utils/format.js';
import { printAnalysisSummary } from '../output/formatter.js';
import { createAnalysisCallbacks } from '../output/progress.js';
import type { YtDlpCookies } from '@lib/types/downloader.js';
import type { CreateAnalysisRequest } from '@lib/types/analysis.js';
import type { CommandHandler, AnalyzeArgs } from '@lib/types/command.js';

function parseAnalyzeArgs(argv: string[]): AnalyzeArgs {
  const result: AnalyzeArgs = { noCache: false, noRefine: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--no-cache') {
      result.noCache = true;
    } else if (arg === '--no-refine') {
      result.noRefine = true;
    } else if (arg === '--threshold') {
      result.threshold = Number(argv[++i]);
    } else if (arg === '--top-n') {
      result.topN = Number(argv[++i]);
    } else if (arg === '--max-chunks') {
      result.maxChunks = Number(argv[++i]);
    } else if (arg === '--max-parallel') {
      result.maxParallel = Number(argv[++i]);
    } else if (arg === '--max-duration') {
      result.maxDuration = Number(argv[++i]);
    } else if (!arg.startsWith('--')) {
      result.url = arg;
    }
  }

  return result;
}

async function run(argv: string[], requestId: string): Promise<void> {
  const args = parseAnalyzeArgs(argv);

  if (args.help) {
    console.log(
      `
Usage: video-clipper analyze <youtube-url> [options]

Options:
  --threshold <n>     Minimum score to keep a segment (default: ${config.SCORE_THRESHOLD})
  --top-n <n>         Maximum number of segments to return (default: ${config.TOP_N_SEGMENTS})
  --max-chunks <n>    Limit transcript chunks sent to LLM
  --max-parallel <n>  Max parallel LLM calls (default: ${config.LLM_CONCURRENCY})
  --max-duration <s>  Abort if video exceeds <s> seconds
  --no-cache          Bypass all caches
  --no-refine         Skip segment refinement (LLM pass 2)
  --help, -h          Show this help
`.trim(),
    );
    return;
  }

  if (!args.url) {
    log.error('analyze', 'No YouTube URL provided.', requestId);
    process.exit(1);
  }

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

  log.info('analyze', `Fetching metadata for ${videoId}...`, requestId);
  const metadata = await extractMetadata(videoId, cookies);
  log.info(
    'analyze',
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

  const input: CreateAnalysisRequest = {
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
      refine: !args.noRefine,
    },
  };

  const abortController = new AbortController();
  process.on('SIGINT', () => {
    log.warn('analyze', 'Received SIGINT — aborting...', requestId);
    abortController.abort();
  });

  const chunkCount = args.maxChunks ?? config.MAX_CHUNKS ?? 0;
  const callbacks = createAnalysisCallbacks(chunkCount, requestId);

  log.info('analyze', `Starting analysis (model: ${config.LLM_MODEL})...`, requestId);
  const plan = await runAnalysis(input, config, callbacks, requestId, abortController.signal);

  printAnalysisSummary(plan);
}

export const analyzeCommand: CommandHandler = {
  name: 'analyze',
  description: 'Analyze a YouTube video and find clip candidates',
  usage: 'video-clipper analyze <youtube-url> [options]',
  run,
};
