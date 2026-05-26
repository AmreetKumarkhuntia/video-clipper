import { analyzeCommand } from './analyze.js';
import { clipCommand } from './clip.js';
import { candidatesCommand } from './candidates.js';
import { libraryCommand } from './library.js';
import { channelCommand } from './channel.js';
import { configCommand } from './config.js';
import { runCommand } from './run.js';
import type { CommandHandler } from '@lib/types/command.js';

export const commands: Map<string, CommandHandler> = new Map([
  ['analyze', analyzeCommand],
  ['clip', clipCommand],
  ['candidates', candidatesCommand],
  ['library', libraryCommand],
  ['channel', channelCommand],
  ['config', configCommand],
  ['run', runCommand],
]);
