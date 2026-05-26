import { listAnalysesFromDb } from '@lib/services/db/repos/analysesRepo.js';
import { listClips, listClipsByVideoId } from '@lib/services/db/repos/clipsRepo.js';
import { printAnalysesList, printClipsList } from '../output/formatter.js';
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
    const clipList = args.videoId ? listClipsByVideoId(args.videoId) : listClips();
    if (args.json) {
      console.log(JSON.stringify(clipList, null, 2));
    } else {
      printClipsList(clipList);
    }
  } else {
    const analyses = listAnalysesFromDb();
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
