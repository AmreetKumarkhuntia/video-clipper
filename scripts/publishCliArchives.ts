import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CliReleaseRecordSchema } from '../src/lib/types/cli.js';
import { publish } from './cliRelease.js';

// Restore the original workflow artifact first. This command deliberately never builds or packs.
const root = process.cwd();
const record = CliReleaseRecordSchema.parse(
  JSON.parse(await readFile(join(root, 'artifacts/releases/release.json'), 'utf8')),
);
await publish(
  {},
  {
    cwd: root,
    env: process.env,
    nextRelease: { version: record.version, channel: record.channel },
    logger: console,
  },
);
