import { log } from '@lib/utils/logger.js';
import { formatSeconds } from '@lib/utils/format.js';
import { tryParseVideoId } from '@lib/utils/youtubeUrl.js';
import { QaAnswerSchema } from '@lib/types/qa.js';
import { apiBaseUrl, apiGet, apiSend, apiStream } from '../client/index.js';
import { backendSettings, describeSetting } from '../client/settings.js';
import type { CommandHandler, AskArgs } from '@lib/types/command.js';
import type { QaAnswer, QaMessage } from '@lib/types/qa.js';
import type { VideoDetails } from '@lib/types/youtube.js';

function formatTimeSec(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function qaPath(videoId: string): string {
  return `/api/videos/${encodeURIComponent(videoId)}/qa`;
}

function describeDuration(durationSec: number): string {
  return durationSec > 0 ? formatSeconds(durationSec) : 'duration unknown';
}

function progressText(data: unknown): string {
  const text = (data as { text?: unknown } | null)?.text;
  return typeof text === 'string' ? text : '';
}

function streamErrorMessage(data: unknown): string {
  const message = (data as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : 'The backend reported an unknown Q&A failure.';
}

/**
 * Which model answers is the backend's choice now, so the CLI has to ask.
 * Tolerant on purpose: this only decorates a log line, and letting a settings
 * hiccup abort the question would be a worse trade than printing "unknown".
 * A backend that is genuinely down still fails loudly on the /api/qa call.
 */
async function currentModelName(): Promise<string> {
  return describeSetting(await backendSettings(), 'LLM_MODEL');
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

The thread lives in the backend at ${apiBaseUrl()}.
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

  const videoId = tryParseVideoId(args.url);
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${args.url}`);
  }

  log.info('ask', `Fetching metadata for ${videoId}...`, requestId);

  // This read write-throughs the channel and video catalog rows on the backend,
  // which is what the command's own upsertVideo call used to be for.
  const video = await apiGet<VideoDetails>(`/api/youtube/videos/${encodeURIComponent(videoId)}`);
  log.info('ask', `Video: "${video.title}" (${describeDuration(video.durationSec)})`, requestId);

  if (args.reset) {
    await apiSend<unknown>(qaPath(videoId), 'DELETE');
    log.info('ask', 'Conversation history cleared.', requestId);
  }

  const history = await apiGet<QaMessage[]>(qaPath(videoId));
  if (history.length > 0) {
    log.info('ask', `Continuing conversation (${history.length} previous messages)`, requestId);
  }

  // apiStream takes no AbortSignal, so Ctrl-C can only stop this end of the
  // conversation: the backend still finishes the model call it started.
  let aborted = false;
  process.on('SIGINT', () => {
    aborted = true;
    log.warn('ask', 'Received SIGINT — aborting...', requestId);
  });

  const model = await currentModelName();
  log.info('ask', `Asking (model: ${model})...`, requestId);
  process.stdout.write('\n');

  let answer: QaAnswer | null = null;

  const stream = apiStream('/api/qa', 'POST', {
    videoId,
    question: args.question,
    history,
    title: video.title,
  });

  for await (const { event, data } of stream) {
    if (aborted) break;

    if (event === 'qa_progress') {
      process.stdout.write(progressText(data));
    } else if (event === 'qa_complete') {
      answer = QaAnswerSchema.parse((data as { answer?: unknown } | null)?.answer);
      process.stdout.write('\n');
    } else if (event === 'error') {
      // Raised verbatim: the backend already phrased this for a human.
      throw new Error(streamErrorMessage(data));
    }
  }

  if (aborted) {
    process.exit(130);
  }

  if (!answer) {
    throw new Error('The backend closed the Q&A stream before sending an answer.');
  }

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
