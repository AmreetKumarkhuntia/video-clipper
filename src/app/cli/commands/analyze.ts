import { log } from '@lib/utils/logger.js';
import { formatSeconds } from '@lib/utils/format.js';
import { tryParseVideoId } from '@lib/utils/youtubeUrl.js';
import { apiBaseUrl, apiGet } from '../client/index.js';
import { streamAnalysis } from '../client/analysisStream.js';
import { backendSettings, describeSetting, numberSetting } from '../client/settings.js';
import { printAnalysisSummary } from '../output/formatter.js';
import { createAnalysisCallbacks } from '../output/progress.js';
import type { CreateAnalysisRequest } from '@lib/types/analysis.js';
import type { CommandHandler, AnalyzeArgs } from '@lib/types/command.js';
import type { VideoDetails } from '@lib/types/youtube.js';

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
    const values = await backendSettings();
    console.log(
      `
Usage: video-clipper analyze <youtube-url> [options]

Options:
  --threshold <n>     Minimum score to keep a segment (default: ${describeSetting(values, 'SCORE_THRESHOLD')})
  --top-n <n>         Maximum number of segments to return (default: ${describeSetting(values, 'TOP_N_SEGMENTS')})
  --max-chunks <n>    Limit transcript chunks sent to LLM
  --max-parallel <n>  Max parallel LLM calls (default: ${describeSetting(values, 'LLM_CONCURRENCY')})
  --max-duration <s>  Abort if video exceeds <s> seconds
  --no-cache          Bypass all caches
  --no-refine         Skip segment refinement (LLM pass 2)
  --help, -h          Show this help

Analysis runs on the backend at ${apiBaseUrl()}, where these defaults live.
`.trim(),
    );
    return;
  }

  if (!args.url) {
    log.error('analyze', 'No YouTube URL provided.', requestId);
    process.exit(1);
  }

  const videoId = tryParseVideoId(args.url);
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${args.url}`);
  }

  log.info('analyze', `Fetching metadata for ${videoId}...`, requestId);

  // This read write-throughs the channel and video catalog rows on the backend,
  // which is what the command's own upsertVideo call used to be for.
  const video = await apiGet<VideoDetails>(`/api/youtube/videos/${encodeURIComponent(videoId)}`);
  log.info(
    'analyze',
    `Video: "${video.title}" (${video.durationSec > 0 ? formatSeconds(video.durationSec) : 'duration unknown'})`,
    requestId,
  );

  // Still checked here rather than server-side: the point is to refuse before
  // spending anything, and the CLI already knows the duration.
  if (args.maxDuration && video.durationSec > 0 && video.durationSec > args.maxDuration) {
    throw new Error(
      `Video duration exceeds --max-duration limit. ` +
        `(${formatSeconds(video.durationSec)} > ${formatSeconds(args.maxDuration)})`,
    );
  }

  const input: CreateAnalysisRequest = {
    videoId,
    title: video.title,
    durationSec: video.durationSec,
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

  // apiStream takes no AbortSignal, so Ctrl-C stops reading and leaves. Dropping
  // the connection is what cancels the run: the route hands the request's signal
  // to the orchestrator, so the LLM work stops server-side too.
  let aborted = false;
  process.on('SIGINT', () => {
    aborted = true;
    log.warn('analyze', 'Received SIGINT — aborting...', requestId);
  });

  const values = await backendSettings();
  const chunkCount = args.maxChunks ?? numberSetting(values, 'MAX_CHUNKS') ?? 0;
  const callbacks = createAnalysisCallbacks(chunkCount, requestId);

  log.info(
    'analyze',
    `Starting analysis (model: ${describeSetting(values, 'LLM_MODEL')})...`,
    requestId,
  );
  const plan = await streamAnalysis(input, callbacks, () => aborted);

  if (aborted) {
    process.exit(130);
  }

  if (!plan) {
    throw new Error('The backend closed the analysis stream before sending a plan.');
  }

  printAnalysisSummary(plan);
}

export const analyzeCommand: CommandHandler = {
  name: 'analyze',
  description: 'Analyze a YouTube video and find clip candidates',
  usage: 'video-clipper analyze <youtube-url> [options]',
  run,
};
