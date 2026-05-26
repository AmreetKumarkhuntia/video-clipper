import { config, setConfigValues, getMaskedConfig } from '@lib/config/index.js';
import { log } from '@lib/utils/logger.js';
import { CONFIG_FIELD_META } from '@lib/types/config.js';
import type { CommandHandler, ConfigArgs } from '@lib/types/command.js';

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
    const masked = getMaskedConfig();
    const entries = Object.entries(masked).sort(([a], [b]) => a.localeCompare(b));

    for (const [key, value] of entries) {
      const meta = CONFIG_FIELD_META[key];
      const desc = meta?.description ? ` (${meta.description})` : '';
      console.log(`${key}${desc} = ${value ?? '(not set)'}`);
    }
    return;
  }

  if (args.reset) {
    try {
      setConfigValues({ [args.key]: '' });
      log.info('config', `Reset ${args.key} to default.`, requestId);
    } catch (err) {
      log.error(
        'config',
        `Failed to reset: ${err instanceof Error ? err.message : String(err)}`,
        requestId,
      );
      process.exit(1);
    }
    return;
  }

  if (args.value !== undefined) {
    try {
      setConfigValues({ [args.key]: args.value });
      log.info('config', `Set ${args.key} = ${args.value}`, requestId);
    } catch (err) {
      log.error(
        'config',
        `Failed to set: ${err instanceof Error ? err.message : String(err)}`,
        requestId,
      );
      process.exit(1);
    }
    return;
  }

  const masked = getMaskedConfig();
  const value = masked[args.key];
  if (value === undefined) {
    const raw = (config as Record<string, unknown>)[args.key];
    if (raw === undefined) {
      log.error('config', `Unknown config key: ${args.key}`, requestId);
      process.exit(1);
    }
    console.log(`${args.key} = ${String(raw)}`);
  } else {
    console.log(`${args.key} = ${value}`);
  }
}

export const configCommand: CommandHandler = {
  name: 'config',
  description: 'View or set configuration values',
  usage: 'video-clipper config [key] [value]',
  run,
};
