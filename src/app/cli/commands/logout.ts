import { apiBaseUrl } from '../client/index.js';
import { retireStoredSessions } from '../client/revocations.js';
import type { CommandHandler } from '@lib/types/command.js';

async function run(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      `
Usage: video-clipper logout

Revokes the session stored for ${apiBaseUrl()} and forgets it locally.
`.trim(),
    );
    return;
  }

  const result = await retireStoredSessions(apiBaseUrl());
  if (!result.hadSessions) {
    console.log(`Not signed in to ${apiBaseUrl()}.`);
    return;
  }

  if (result.failures > 0) {
    throw new Error(
      `Signed out locally, but ${result.failures} server session revocation(s) failed. ` +
        'They remain queued securely and will be retried by the next login or logout.',
    );
  }
  console.log(`Signed out of ${apiBaseUrl()}.`);
}

export const logoutCommand: CommandHandler = {
  name: 'logout',
  description: 'Revoke and forget the stored session',
  usage: 'video-clipper logout',
  run,
};
