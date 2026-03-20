#!/usr/bin/env node
import { log } from './utils/logger.js';
import { formatConfig } from './utils/redactConfig.js';
import { config } from './config/index.js';
import { parseArgs, printUsage } from './cli.js';
import { runPipeline } from './pipeline/runner.js';

const args = parseArgs(process.argv);

if (args.help) {
  printUsage();
  process.exit(0);
}

if (!args.url) {
  log.error('No YouTube URL provided.');
  printUsage();
  process.exit(1);
}

if (args.localVideo && !args.clip) {
  log.error('--local-video requires --clip flag');
  printUsage();
  process.exit(1);
}

if (args.localVideo && args.downloadSections) {
  log.warn(
    '--download-sections is ignored when using --local-video (clipping all segments from --top-n)',
  );
}

log.info(
  `Starting video-clipper (model: ${config.LLM_MODEL})` +
    (args.clip ? ' [--clip enabled]' : '') +
    (args.localVideo ? ` [--local-video: ${args.localVideo}]` : '') +
    (args.downloadSections !== undefined && args.downloadSections !== 'all'
      ? ` [--download-sections: ${args.downloadSections}]`
      : '') +
    (args.videoPath ? ` [--video-path: ${args.videoPath}]` : ''),
);
log.info(`Config: ${formatConfig(config)}`);

runPipeline(args).catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
