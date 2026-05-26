import { getAnalysisFromDb } from '@lib/services/db/repos/analysesRepo.js';
import { log } from '@lib/utils/logger.js';
import { printCandidates } from '../output/formatter.js';
import type { CommandHandler, CandidatesArgs } from '@lib/types/command.js';

function parseCandidatesArgs(argv: string[]): CandidatesArgs {
  const result: CandidatesArgs = { json: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--json') {
      result.json = true;
    } else if (!arg.startsWith('--')) {
      result.analysisId = arg;
    }
  }

  return result;
}

async function run(argv: string[], requestId: string): Promise<void> {
  const args = parseCandidatesArgs(argv);

  if (args.help) {
    console.log(
      `
Usage: video-clipper candidates <analysis-id> [options]

Options:
  --json       Output raw JSON
  --help, -h   Show this help
`.trim(),
    );
    return;
  }

  if (!args.analysisId) {
    log.error('candidates', 'No analysis ID provided.', requestId);
    console.log('\nUsage: video-clipper candidates <analysis-id>');
    console.log('Run "video-clipper library" to see available analyses.');
    process.exit(1);
  }

  const plan = getAnalysisFromDb(args.analysisId);
  if (!plan) {
    log.error('candidates', `Analysis not found: ${args.analysisId}`, requestId);
    console.log('Run "video-clipper library" to see available analyses.');
    process.exit(1);
  }

  if (args.json) {
    console.log(JSON.stringify(plan.candidates, null, 2));
    return;
  }

  console.log(`\nCandidates for "${plan.title}" (${plan.videoId}):\n`);
  printCandidates(plan);
}

export const candidatesCommand: CommandHandler = {
  name: 'candidates',
  description: 'List clip candidates for a saved analysis',
  usage: 'video-clipper candidates <analysis-id> [--json]',
  run,
};
