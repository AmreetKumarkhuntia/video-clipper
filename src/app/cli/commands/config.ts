import { log } from '@lib/utils/logger.js';
import { apiBaseUrl, apiGet, apiSend } from '../client/index.js';
import type { CommandHandler, ConfigArgs } from '@lib/types/command.js';
import type { SettingsResponse, SettingsUpdateResponse } from '@lib/types/api.js';

const SETTINGS_PATH = '/api/settings';

function parseConfigArgs(argv: string[]): ConfigArgs {
  const result: ConfigArgs = { reset: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--reset') {
      result.reset = true;
    } else if (!arg.startsWith('--') && !result.key) {
      result.key = arg;
    } else if (!arg.startsWith('--') && result.key && !result.value) {
      result.value = arg;
    }
  }

  return result;
}

/**
 * Secret fields come back as `{ hasValue, masked }` — the raw value never leaves
 * the backend — while everything else is a plain scalar. The mask exists to be
 * shown, so it is what gets printed.
 */
function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '(not set)';
  if (typeof value === 'object') {
    const secret = value as Record<string, unknown>;
    const masked = secret.masked;
    return secret.hasValue === true && typeof masked === 'string' ? masked : '(not set)';
  }
  return String(value);
}

/** Descriptions come from the running backend's registry, not a local copy. */
function describeKeys(registry: SettingsResponse['registry']): Map<string, string> {
  const descriptions = new Map<string, string>();
  for (const group of registry.groups) {
    for (const field of group.fields) descriptions.set(field.key, field.description);
  }
  return descriptions;
}

/** An empty value tells the backend to drop the override and fall back to its default. */
async function writeSetting(key: string, value: string): Promise<SettingsUpdateResponse> {
  return apiSend<SettingsUpdateResponse>(SETTINGS_PATH, 'PATCH', { [key]: value });
}

async function run(argv: string[], requestId: string): Promise<void> {
  const args = parseConfigArgs(argv);

  if (args.help) {
    console.log(
      `
Usage: video-clipper config [key] [value]

  No args       Show all config values
  <key>         Show value for a specific key
  <key> <value> Set a config value
  --reset       Reset a key to default (use with <key>)

These are the backend's settings, not this machine's. They are read from and
written to ${apiBaseUrl()}, so a change here applies to everyone that backend
serves, the web app included.

Examples:
  video-clipper config
  video-clipper config LLM_MODEL
  video-clipper config LLM_MODEL gpt-4o
  video-clipper config LLM_MODEL --reset
`.trim(),
    );
    return;
  }

  if (!args.key) {
    const { registry, values } = await apiGet<SettingsResponse>(SETTINGS_PATH);
    const descriptions = describeKeys(registry);
    const entries = Object.entries(values).sort(([a], [b]) => a.localeCompare(b));

    for (const [key, value] of entries) {
      const description = descriptions.get(key);
      const desc = description ? ` (${description})` : '';
      console.log(`${key}${desc} = ${renderValue(value)}`);
    }
    return;
  }

  if (args.reset) {
    const result = await writeSetting(args.key, '');
    log.info('config', `Reset ${args.key} to default on ${apiBaseUrl()}.`, requestId);
    for (const warning of result.warnings) log.warn('config', warning, requestId);
    return;
  }

  if (args.value !== undefined) {
    const result = await writeSetting(args.key, args.value);
    log.info('config', `Set ${args.key} = ${args.value} on ${apiBaseUrl()}`, requestId);
    for (const warning of result.warnings) log.warn('config', warning, requestId);
    return;
  }

  const { values } = await apiGet<SettingsResponse>(SETTINGS_PATH);
  const value = values[args.key];

  // The backend reports every key it holds, so a key missing from that answer is
  // unknown to it — there is no second, local place left to look.
  if (value === undefined) {
    log.error('config', `Unknown config key: ${args.key}`, requestId);
    process.exit(1);
  }

  console.log(`${args.key} = ${renderValue(value)}`);
}

export const configCommand: CommandHandler = {
  name: 'config',
  description: "View or set the backend's configuration values",
  usage: 'video-clipper config [key] [value]',
  run,
};
