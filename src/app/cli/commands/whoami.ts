import { apiBaseUrl, apiGet } from '../client/index.js';
import type { CommandHandler } from '@lib/types/command.js';
import type { MeResponse } from '@lib/types/api.js';

async function run(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      `
Usage: video-clipper whoami

Shows the account this machine is signed in as on ${apiBaseUrl()}.
`.trim(),
    );
    return;
  }

  const { customer } = await apiGet<MeResponse>('/api/me');
  console.log(`Backend:     ${apiBaseUrl()}`);
  console.log(`Account:     ${customer.email ?? '(no email)'}`);
  if (customer.name) console.log(`Name:        ${customer.name}`);
  console.log(`Role:        ${customer.role}`);
  console.log(
    `Permissions: ${customer.permissions.length ? customer.permissions.join(', ') : '(none)'}`,
  );
  if (customer.channelId) console.log(`Channel:     ${customer.channelId}`);
}

export const whoamiCommand: CommandHandler = {
  name: 'whoami',
  description: 'Show the signed-in account',
  usage: 'video-clipper whoami',
  run,
};
