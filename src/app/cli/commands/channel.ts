import { GoogleYouTubeCatalogService } from '@lib/services/video/source/youtube/catalog.js';
import { config } from '@lib/config/index.js';
import { log } from '@lib/utils/logger.js';
import { formatSeconds } from '@lib/utils/format.js';
import { printTable } from '../output/formatter.js';
import type { CommandHandler, ChannelArgs } from '@lib/types/command.js';

function parseChannelArgs(argv: string[]): ChannelArgs {
  const result: ChannelArgs = { json: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--json') {
      result.json = true;
    } else if (arg === '--page-token') {
      result.pageToken = argv[++i];
    } else if (!arg.startsWith('--')) {
      result.input = arg;
    }
  }

  return result;
}

async function run(argv: string[], requestId: string): Promise<void> {
  const args = parseChannelArgs(argv);

  if (args.help) {
    console.log(
      `
Usage: video-clipper channel <handle/url/id> [options]

Options:
  --page-token <token>  Pagination token for next page of videos
  --json                Output raw JSON
  --help, -h            Show this help

Requires YOUTUBE_API_KEY to be set in config.
`.trim(),
    );
    return;
  }

  if (!args.input) {
    log.error('channel', 'No channel handle, URL, or ID provided.', requestId);
    process.exit(1);
  }

  if (!config.YOUTUBE_API_KEY) {
    log.error(
      'channel',
      'YOUTUBE_API_KEY is required. Set it via: video-clipper config YOUTUBE_API_KEY <key>',
      requestId,
    );
    process.exit(1);
  }

  const catalog = new GoogleYouTubeCatalogService(config.YOUTUBE_API_KEY);

  log.info('channel', `Resolving channel: ${args.input}...`, requestId);
  const channel = await catalog.resolveChannel(args.input);

  if (args.json) {
    const videos = await catalog.listChannelVideos(channel.id, args.pageToken);
    console.log(JSON.stringify({ channel, videos }, null, 2));
    return;
  }

  console.log('');
  console.log(`Channel : ${channel.title}`);
  console.log(`ID      : ${channel.id}`);
  if (channel.description) {
    const desc =
      channel.description.length > 100
        ? `${channel.description.slice(0, 97)}...`
        : channel.description;
    console.log(`About   : ${desc}`);
  }
  console.log('');

  log.info('channel', 'Fetching videos...', requestId);
  const page = await catalog.listChannelVideos(channel.id, args.pageToken);

  if (page.videos.length === 0) {
    console.log('No videos found.');
    return;
  }

  const headers = ['Video ID', 'Title', 'Duration', 'Published'];
  const rows = page.videos.map((v) => [
    v.id,
    v.title.length > 50 ? `${v.title.slice(0, 47)}...` : v.title,
    v.durationSec > 0 ? formatSeconds(v.durationSec) : '?',
    v.publishedAt ? v.publishedAt.slice(0, 10) : '',
  ]);
  printTable(headers, rows);

  if (page.nextPageToken) {
    console.log(
      `\nMore videos: video-clipper channel ${args.input} --page-token ${page.nextPageToken}`,
    );
  }

  console.log(`\nTo analyze a video: video-clipper analyze https://youtube.com/watch?v=<VIDEO_ID>`);
}

export const channelCommand: CommandHandler = {
  name: 'channel',
  description: 'Resolve a YouTube channel and list videos',
  usage: 'video-clipper channel <handle/url/id> [--json]',
  run,
};
