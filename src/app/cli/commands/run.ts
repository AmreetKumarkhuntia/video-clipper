import { config } from '@lib/config/index.js';
import { formatConfig } from '@lib/utils/format.js';
import { log } from '@lib/utils/logger.js';
import { parseArgs, printUsage } from '../args.js';
import { runPipeline } from '../pipeline/runner.js';
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

  if (args.localVideo && !args.clip) {
    log.error('run', '--local-video requires --clip flag', requestId);
    process.exit(1);
  }

  log.info(
    'run',
    `Starting video-clipper (model: ${config.LLM_MODEL})` +
      (args.clip ? ' [--clip enabled]' : '') +
      (args.localVideo ? ` [--local-video: ${args.localVideo}]` : ''),
    requestId,
  );
  log.info('run', `Config: ${formatConfig(config)}`, requestId);

  await runPipeline(args, requestId);
}

export const runCommand: CommandHandler = {
  name: 'run',
  description: 'One-shot pipeline: analyze + clip in one command (legacy)',
  usage: 'video-clipper run <youtube-url> [options]',
  run,
};
