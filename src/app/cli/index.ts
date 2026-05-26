#!/usr/bin/env node
import { generateRequestId, log } from '@lib/utils/logger.js';
import { runMigrations } from '@lib/services/db/migrate.js';
import { commands } from './commands/index.js';

runMigrations();

const requestId = generateRequestId();
const subcommand = process.argv[2];

function isUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('youtu');
}

function printHelp(): void {
  console.log(
    `
video-clipper — Analyze YouTube videos and generate clips

Usage: video-clipper <command> [options]

Commands:
  analyze <url>          Analyze a YouTube video and find clip candidates
  clip <analysis-id>     Generate video clips from an analysis
  candidates <id>        List clip candidates for a saved analysis
  library                Browse saved analyses and generated clips
  channel <handle/url>   Resolve a YouTube channel and list videos
  config [key] [value]   View or set configuration values
  run <url>              One-shot pipeline: analyze + clip (legacy)

Run "video-clipper <command> --help" for command-specific options.
`.trim(),
  );
}

async function main(): Promise<void> {
  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    printHelp();
    return;
  }

  // Backward compat: bare URL routes to the `run` command
  if (isUrl(subcommand)) {
    const handler = commands.get('run')!;
    await handler.run(process.argv.slice(2), requestId);
    return;
  }

  const handler = commands.get(subcommand);
  if (!handler) {
    log.error('main', `Unknown command: ${subcommand}`, requestId);
    printHelp();
    process.exit(1);
  }

  await handler.run(process.argv.slice(3), requestId);
}

main().catch((err) => {
  log.error('main', err instanceof Error ? err.message : String(err), requestId);
  process.exit(1);
});
