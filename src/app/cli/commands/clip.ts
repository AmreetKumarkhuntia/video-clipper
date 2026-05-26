import { getAnalysisFromDb } from '@lib/services/db/repos/analysesRepo.js';
import { generateClipsForAnalysis } from '@lib/orchestration/clipOrchestrator.js';
import { config } from '@lib/config/index.js';
import { log } from '@lib/utils/logger.js';
import { printClipResults } from '../output/formatter.js';
import type { CommandHandler, ClipArgs } from '@lib/types/command.js';
import type { CreateClipsRequest } from '@lib/types/analysis.js';

function parseClipArgs(argv: string[]): ClipArgs {
  const result: ClipArgs = { help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--download-sections') {
      const val = argv[++i];
      if (val === 'all') {
        result.downloadSections = 'all';
      } else {
        result.downloadSections = Number(val);
      }
    } else if (arg === '--local-video') {
      result.localVideo = argv[++i];
    } else if (arg === '--video-path') {
      result.videoPath = argv[++i];
    } else if (arg === '--candidates') {
      result.candidates = argv[++i].split(',').map(Number);
    } else if (!arg.startsWith('--')) {
      result.analysisId = arg;
    }
  }

  return result;
}

async function run(argv: string[], requestId: string): Promise<void> {
  const args = parseClipArgs(argv);

  if (args.help) {
    console.log(
      `
Usage: video-clipper clip <analysis-id> [options]

Options:
  --candidates <ranks>       Comma-separated candidate ranks to clip (default: all)
  --download-sections <mode> 'all' or N (top N segments)
  --local-video <path>       Path to local video file (skip download)
  --video-path <path>        Custom output directory
  --help, -h                 Show this help
`.trim(),
    );
    return;
  }

  if (!args.analysisId) {
    log.error('clip', 'No analysis ID provided.', requestId);
    console.log('\nUsage: video-clipper clip <analysis-id>');
    console.log('Run "video-clipper library" to see available analyses.');
    process.exit(1);
  }

  const plan = getAnalysisFromDb(args.analysisId);
  if (!plan) {
    log.error('clip', `Analysis not found: ${args.analysisId}`, requestId);
    console.log('Run "video-clipper library" to see available analyses.');
    process.exit(1);
  }

  let candidates = plan.candidates;
  if (args.candidates) {
    const rankSet = new Set(args.candidates);
    candidates = candidates.filter((c) => rankSet.has(c.rank));
    if (candidates.length === 0) {
      log.error('clip', 'No candidates match the specified ranks.', requestId);
      process.exit(1);
    }
  }

  log.info(
    'clip',
    `Generating ${candidates.length} clip${candidates.length !== 1 ? 's' : ''} for "${plan.title}"...`,
    requestId,
  );

  const input: CreateClipsRequest = {
    videoId: plan.videoId,
    analysisId: plan.id,
    segments: candidates.map((c) => ({
      id: c.id,
      rank: c.rank,
      startSec: c.startSec,
      endSec: c.endSec,
      score: c.score,
      reason: c.reason,
      source: c.source,
      audioEvent: c.audioEvent,
    })),
  };

  const clips = await generateClipsForAnalysis(input, config, requestId);
  printClipResults(clips);
}

export const clipCommand: CommandHandler = {
  name: 'clip',
  description: 'Generate video clips from an analysis',
  usage: 'video-clipper clip <analysis-id> [options]',
  run,
};
