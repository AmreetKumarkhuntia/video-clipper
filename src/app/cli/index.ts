#!/usr/bin/env node
import { log, generateRequestId } from '@lib/utils/logger.js';
import { formatConfig } from '@lib/utils/format.js';
import { config } from '@lib/config/index.js';
import { parseArgs, printUsage } from './args.js';
import { runPipeline } from './pipeline/runner.js';

const cliRequestId = generateRequestId();
const args = parseArgs(process.argv);

if (args.help) {
  printUsage();
  process.exit(0);
}

if (!args.url) {
  log.error('main', 'No YouTube URL provided.', cliRequestId);
  printUsage();
  process.exit(1);
}

if (args.localVideo && !args.clip) {
  log.error('main', '--local-video requires --clip flag', cliRequestId);
  printUsage();
  process.exit(1);
}

if (args.localVideo && args.downloadSections) {
  log.warn(
    'main',
    '--download-sections is ignored when using --local-video (clipping all segments from --top-n)',
    cliRequestId,
  );
}

log.info(
  'main',
  `Starting video-clipper (model: ${config.LLM_MODEL})` +
    (args.clip ? ' [--clip enabled]' : '') +
    (args.localVideo ? ` [--local-video: ${args.localVideo}]` : '') +
    (args.downloadSections !== undefined && args.downloadSections !== 'all'
      ? ` [--download-sections: ${args.downloadSections}]`
      : '') +
    (args.videoPath ? ` [--video-path: ${args.videoPath}]` : ''),
  cliRequestId,
);
log.info('main', `Config: ${formatConfig(config)}`, cliRequestId);

runPipeline(args, cliRequestId).catch((err) => {
  log.error('main', err instanceof Error ? err.message : String(err), cliRequestId);
  process.exit(1);
});
