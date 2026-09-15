import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CliReleaseRecordSchema } from '../src/lib/types/cli.js';
import { readManifest } from './cliPackage.js';
import { prepare } from './cliRelease.js';

const root = process.cwd();
const directory = join(root, 'artifacts/cli');
const manifest = await readManifest(directory);
// Exercise the real preparation hook. No publish hook or registry credentials are used.
await prepare(
  {},
  { cwd: root, env: {}, nextRelease: { version: manifest.version }, logger: console },
);
const record = CliReleaseRecordSchema.parse(
  JSON.parse(await readFile(join(root, 'artifacts/releases/release.json'), 'utf8')),
);
for (const archive of record.archives) {
  console.log(
    `Verified ${archive.filename}: ${archive.files.length} files, ${archive.size} bytes packed, ${archive.unpackedSize} bytes unpacked.`,
  );
}
