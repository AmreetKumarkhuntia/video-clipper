import { createHash } from 'node:crypto';
import { isBuiltin } from 'node:module';
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix, resolve } from 'node:path';
import { build } from 'esbuild';
import { execa } from 'execa';
import { z } from 'zod';
import {
  CliBuildRecordSchema,
  CliPackageManifestSchema,
  CliPackedArchiveSchema,
} from '../src/lib/types/cli.js';
import type { CliBuildRecord, CliPackageManifest, CliPackedArchive } from '../src/lib/types/cli.js';

export const CLI_FILES = ['LICENSE', 'README.md', 'bin/vdclip.js', 'package.json'];

export async function readManifest(directory: string): Promise<CliPackageManifest> {
  return CliPackageManifestSchema.parse(
    JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')),
  );
}

export async function fileHash(file: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
}

/** Reject even transitive internal imports outside the client's permitted source layers. */
export function assertCliInputs(inputs: string[]): void {
  const allowed = ['src/app/cli/', 'src/lib/types/', 'src/lib/utils/'];
  for (const input of inputs) {
    const normalized = posix.normalize(input.replaceAll('\\', '/'));
    if (!allowed.some((prefix: string): boolean => normalized.startsWith(prefix))) {
      throw new Error(`The CLI bundle cannot include ${input}.`);
    }
  }
}

export async function buildCli(
  root: string,
  artifacts: string = join(root, 'artifacts'),
): Promise<CliBuildRecord> {
  const manifest = await readManifest(join(root, 'packages/cli'));
  const destination = join(artifacts, 'cli');
  await rm(destination, { recursive: true, force: true });
  await mkdir(join(destination, 'bin'), { recursive: true });

  // Resolve aliases through the existing TypeScript configuration. Third-party
  // packages remain external so open keeps its platform-specific support files.
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['src/app/cli/index.ts'],
    outfile: join(destination, manifest.bin.vdclip),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    packages: 'external',
    tsconfig: join(root, 'tsconfig.json'),
    metafile: true,
    write: false,
  });
  const inputs = Object.keys(result.metafile.inputs).sort();
  assertCliInputs(inputs);
  const externals = [
    ...new Set(
      Object.values(result.metafile.outputs).flatMap((output): string[] =>
        output.imports
          .filter((entry): boolean => entry.external === true)
          .map((entry): string => entry.path),
      ),
    ),
  ].sort();
  const dependencies = Object.keys(manifest.dependencies);
  for (const dependency of externals) {
    if (!isBuiltin(dependency) && !dependencies.includes(dependency)) {
      throw new Error(`Undeclared CLI dependency: ${dependency}`);
    }
  }
  for (const dependency of dependencies) {
    if (!externals.includes(dependency)) throw new Error(`Unused CLI dependency: ${dependency}`);
  }

  for (const file of result.outputFiles) await writeFile(file.path, file.contents);
  await chmod(join(destination, manifest.bin.vdclip), 0o755);
  await writeFile(join(destination, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await copyFile(join(root, 'packages/cli/README.md'), join(destination, 'README.md'));
  await copyFile(join(root, 'LICENSE'), join(destination, 'LICENSE'));
  const { stdout: sourceCommit } = await execa('git', ['rev-parse', 'HEAD'], { cwd: root });
  const { stdout: status } = await execa('git', ['status', '--porcelain'], { cwd: root });
  const record = CliBuildRecordSchema.parse({
    sourceCommit,
    sourceDirty: status.length > 0,
    executableSha256: await fileHash(join(destination, manifest.bin.vdclip)),
    inputs,
    externals,
  });
  await writeFile(join(artifacts, 'cli-build.json'), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export async function verifyCliBuild(root: string): Promise<CliBuildRecord> {
  const record = CliBuildRecordSchema.parse(
    JSON.parse(await readFile(join(root, 'artifacts/cli-build.json'), 'utf8')),
  );
  assertCliInputs(record.inputs);
  const manifest = await readManifest(join(root, 'artifacts/cli'));
  if (
    (await fileHash(join(root, 'artifacts/cli', manifest.bin.vdclip))) !== record.executableSha256
  ) {
    throw new Error('The CLI executable changed after its build was recorded.');
  }
  return record;
}

export function assertArchiveContents(
  archive: CliPackedArchive,
  manifest: CliPackageManifest,
): void {
  if (archive.name !== manifest.name || archive.version !== manifest.version) {
    throw new Error('Packed CLI name/version does not match its manifest.');
  }
  const files = archive.files.map((file): string => file.path).sort();
  if (JSON.stringify(files) !== JSON.stringify(CLI_FILES)) {
    throw new Error(`Unexpected CLI package contents: ${files.join(', ')}`);
  }
}

export async function packCli(
  directory: string,
  archiveDirectory: string,
): Promise<CliPackedArchive> {
  await mkdir(archiveDirectory, { recursive: true });
  const manifest = await readManifest(directory);
  const { stdout } = await execa(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', archiveDirectory],
    {
      cwd: directory,
      timeout: 60_000,
    },
  );
  const [archive] = z.tuple([CliPackedArchiveSchema]).parse(JSON.parse(stdout));
  assertArchiveContents(archive, manifest);
  return archive;
}

/** Check installed dependency files as well as declared dependencies. */
async function assertNoNativeDependencies(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await assertNoNativeDependencies(file);
    else if (entry.name.endsWith('.node'))
      throw new Error(`Native dependency in CLI install: ${file}`);
  }
}

/** A normal npm installation, in a directory with no access to the repository's node_modules. */
export async function installCliArchive(archive: string, destination: string): Promise<string> {
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'package.json'), '{"private":true}\n');
  await execa('npm', ['install', resolve(archive), '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: destination,
    timeout: 120_000,
  });
  const lock = z
    .object({
      packages: z.record(
        z.string(),
        z.object({
          hasInstallScript: z.boolean().optional(),
        }),
      ),
    })
    .parse(JSON.parse(await readFile(join(destination, 'package-lock.json'), 'utf8')));
  const allowedDependencies = new Set([
    'nanoid',
    'zod',
    'open',
    'default-browser',
    'default-browser-id',
    'define-lazy-prop',
    'is-inside-container',
    'is-docker',
    'is-wsl',
    'wsl-utils',
    'bundle-name',
    'run-applescript',
    'vdclip',
    '@amreetkumarkhuntia/vdclip',
  ]);
  for (const [packagePath, dependency] of Object.entries(lock.packages)) {
    if (!packagePath) continue;
    const name = packagePath.split('node_modules/').at(-1) ?? '';
    if (!allowedDependencies.has(name) || dependency.hasInstallScript) {
      throw new Error(`Unexpected dependency or install script in CLI installation: ${name}`);
    }
  }
  await assertNoNativeDependencies(join(destination, 'node_modules'));
  const packagePath = Object.keys(lock.packages).find((key: string): boolean =>
    /node_modules\/(?:vdclip|@amreetkumarkhuntia\/vdclip)$/.test(key),
  );
  if (!packagePath) throw new Error('The archive did not install a vdclip package.');
  return join(destination, packagePath);
}

export async function smokeCliArchive(
  archive: string,
  expected: CliPackageManifest,
  executableSha256: string,
): Promise<void> {
  const temporary = await mkdtemp(join(tmpdir(), 'video-clipper-install-'));
  try {
    const installed = await installCliArchive(archive, temporary);
    const manifest = await readManifest(installed);
    if (JSON.stringify(manifest) !== JSON.stringify(expected))
      throw new Error('Installed CLI manifest differs from the packed manifest.');
    const executable = join(installed, manifest.bin.vdclip);
    if ((await fileHash(executable)) !== executableSha256)
      throw new Error('Installed CLI executable does not match the verified build.');
    const { stdout: version } = await execa(process.execPath, [executable, '--version'], {
      cwd: temporary,
      timeout: 10_000,
    });
    if (version !== expected.version)
      throw new Error('Installed CLI reports the wrong release version.');
    for (const command of [
      [],
      ['run'],
      ['analyze'],
      ['login'],
      ['logout'],
      ['whoami'],
      ['library'],
      ['candidates'],
      ['clip'],
      ['channel'],
      ['ask'],
      ['config'],
    ]) {
      const { stdout } = await execa(process.execPath, [executable, ...command, '--help'], {
        cwd: temporary,
        env: { VIDEO_CLIPPER_API_URL: 'http://127.0.0.1:1' },
        timeout: 10_000,
      });
      if (!stdout.includes('Usage:')) throw new Error(`Missing CLI help for ${command.join(' ')}`);
    }
    // Verify npm's actual POSIX bin link / Windows command shim, not just the JS entry.
    const shim = join(
      temporary,
      'node_modules/.bin',
      process.platform === 'win32' ? 'vdclip.cmd' : 'vdclip',
    );
    const result = await execa(shim, ['--version'], { cwd: temporary, timeout: 10_000 });
    if (result.stdout !== expected.version)
      throw new Error('Installed command shim does not work.');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function buildReleasePlugin(root: string): Promise<void> {
  await build({
    absWorkingDir: root,
    entryPoints: ['scripts/cliRelease.ts'],
    outfile: join(root, 'artifacts/release/cliRelease.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    packages: 'external',
  });
}
