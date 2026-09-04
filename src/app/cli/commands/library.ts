import { apiGet } from '../client/index.js';
import { printAnalysesList, printClipsList } from '../output/formatter.js';
import type { ClipArtifact, ClipPlan } from '@lib/types/analysis.js';
import type { CommandHandler, LibraryArgs } from '@lib/types/command.js';

function parseLibraryArgs(argv: string[]): LibraryArgs {
  const result: LibraryArgs = { mode: 'analyses', json: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--clips') {
      result.mode = 'clips';
    } else if (arg === '--analyses') {
      result.mode = 'analyses';
    } else if (arg === '--video-id') {
      result.videoId = argv[++i];
    } else if (arg === '--json') {
      result.json = true;
    }
  }

  return result;
}

/**
 * `GET /api/clips` only filters by `analysisId`, so `--video-id` is narrowed
 * here rather than pushed to the server. The backend hands back the same
 * newest-first ordering the old `listClipsByVideoId` used, and filtering keeps
 * that order, so the table is byte-identical to the in-process version.
 */
async function fetchClips(videoId: string | undefined): Promise<ClipArtifact[]> {
  const { clips } = await apiGet<{ clips: ClipArtifact[] }>('/api/clips');
  return videoId ? clips.filter((clip) => clip.videoId === videoId) : clips;
}

async function run(argv: string[], _requestId: string): Promise<void> {
  const args = parseLibraryArgs(argv);

  if (args.help) {
    console.log(
      `
Usage: video-clipper library [options]

Options:
  --analyses         List saved analyses (default)
  --clips            List generated clips
  --video-id <id>    Filter clips by video ID
  --json             Output raw JSON
  --help, -h         Show this help
`.trim(),
    );
    return;
  }

  if (args.mode === 'clips') {
    const clipList = await fetchClips(args.videoId);
    if (args.json) {
      console.log(JSON.stringify(clipList, null, 2));
    } else {
      printClipsList(clipList);
    }
  } else {
    const { analyses } = await apiGet<{ analyses: ClipPlan[] }>('/api/analyses');
    if (args.json) {
      console.log(JSON.stringify(analyses, null, 2));
    } else {
      printAnalysesList(analyses);
    }
  }
}

export const libraryCommand: CommandHandler = {
  name: 'library',
  description: 'Browse saved analyses and generated clips',
  usage: 'video-clipper library [--analyses | --clips] [--json]',
  run,
};
