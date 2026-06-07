import { parseUrl } from '@lib/services/video/source/youtube/parser.js';
import { extractMetadata } from '@lib/services/video/source/youtube/metadata.js';
import { answerVideoQuestion } from '@lib/orchestration/qaOrchestrator.js';
import { findQaMessages, clearQaMessages } from '@lib/services/db/repos/qaMessagesRepo.js';
import { upsertVideo } from '@lib/services/db/repos/videosRepo.js';
import { config } from '@lib/config/index.js';
import { log } from '@lib/utils/logger.js';
import { formatSeconds } from '@lib/utils/format.js';
import type { YtDlpCookies } from '@lib/types/downloader.js';
import type { CommandHandler, AskArgs } from '@lib/types/command.js';
import type { QaMessage } from '@lib/types/qa.js';

function formatTimeSec(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseAskArgs(argv: string[]): AskArgs {
  const result: AskArgs = { reset: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--reset') {
      result.reset = true;
    } else if (!result.url && !arg.startsWith('--')) {
      result.url = arg;
    } else if (!result.question && !arg.startsWith('--')) {
      result.question = arg;
    }
  }

  return result;
}

async function run(argv: string[], requestId: string): Promise<void> {
  const args = parseAskArgs(argv);

  if (args.help) {
    console.log(
      `
Usage: video-clipper ask <youtube-url> "<question>" [options]

Options:
  --reset       Clear the conversation history before asking
  --help, -h    Show this help

Each invocation appends to the persisted conversation thread. Consecutive
calls form a multi-turn chat. Use --reset to start a fresh conversation.
`.trim(),
    );
    return;
  }

  if (!args.url) {
    log.error('ask', 'No YouTube URL provided.', requestId);
    process.exit(1);
  }

  if (!args.question) {
    log.error(
      'ask',
      'No question provided. Usage: video-clipper ask <url> "<question>"',
      requestId,
    );
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

  log.info('ask', `Fetching metadata for ${videoId}...`, requestId);
  const metadata = await extractMetadata(videoId, cookies);
  log.info(
    'ask',
    `Video: "${metadata.title}" (${metadata.duration > 0 ? formatSeconds(metadata.duration) : 'duration unknown'})`,
    requestId,
  );

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

  if (args.reset) {
    clearQaMessages(videoId);
    log.info('ask', 'Conversation history cleared.', requestId);
  }

  const history: QaMessage[] = findQaMessages(videoId);
  if (history.length > 0) {
    log.info('ask', `Continuing conversation (${history.length} previous messages)`, requestId);
  }

  const abortController = new AbortController();
  process.on('SIGINT', () => {
    log.warn('ask', 'Received SIGINT — aborting...', requestId);
    abortController.abort();
  });

  log.info('ask', `Asking (model: ${config.LLM_MODEL})...`, requestId);
  process.stdout.write('\n');

  const answer = await answerVideoQuestion(
    {
      videoId,
      question: args.question,
      history,
      title: metadata.title,
    },
    config,
    {
      onStarted: () => {
        // nothing
      },
      onProgress: (text) => {
        process.stdout.write(text);
      },
      onComplete: () => {
        process.stdout.write('\n');
      },
    },
    requestId,
    abortController.signal,
  );

  if (answer.citations.length > 0) {
    console.log('\nTimestamps cited:');
    for (const cite of answer.citations) {
      console.log(`  ${cite.label}  →  ${formatTimeSec(cite.timeSec)}`);
    }
  }
}

export const askCommand: CommandHandler = {
  name: 'ask',
  description: 'Ask a question about a YouTube video using its transcript',
  usage: 'video-clipper ask <youtube-url> "<question>" [--reset]',
  run,
};
