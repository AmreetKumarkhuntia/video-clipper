import { log } from '@lib/utils/logger.js';
import { apiGet, apiSend } from '../client/index.js';
import { printClipResults } from '../output/formatter.js';
import type { CommandHandler, ClipArgs } from '@lib/types/command.js';
import type { ClipArtifact, ClipPlan, CreateClipsRequest } from '@lib/types/analysis.js';

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

  // A missing analysis is a 404 the client turns into a thrown message, so there
  // is no null to test for — the entrypoint reports it and exits non-zero.
  const plan = await apiGet<ClipPlan>(`/api/analyses/${encodeURIComponent(args.analysisId)}`);

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
    options: {
      localVideo: args.localVideo,
      videoPath: args.videoPath,
      downloadSections: args.downloadSections,
    },
  };

  // Downloading and cutting stays on the backend rather than moving here: the
  // clip rows it writes point at files the backend also serves to the web app,
  // so cutting locally would produce library entries whose media it cannot read.
  // The request is held open for the whole render, which is why there is no
  // progress output — a plain response, not a stream.
  const { clips } = await apiSend<{ clips: ClipArtifact[] }>('/api/clips', 'POST', input);
  printClipResults(clips);
}

export const clipCommand: CommandHandler = {
  name: 'clip',
  description: 'Generate video clips from an analysis',
  usage: 'video-clipper clip <analysis-id> [options]',
  run,
};
