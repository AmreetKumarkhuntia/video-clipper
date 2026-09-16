import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import { z } from 'zod';
import {
  CliPackageManifestSchema,
  CliReleaseArchiveSchema,
  CliReleaseRecordSchema,
  type CliReleaseArchive,
  type CliReleaseContext,
  type CliReleaseRecord,
} from '../src/lib/types/cli.js';
import { fileHash, packCli, readManifest, smokeCliArchive, verifyCliBuild } from './cliPackage.js';

/** npm's version preparation runs before this hook; the executable is never rebuilt here. */
export async function prepare(_options: unknown, context: CliReleaseContext): Promise<void> {
  const root = context.cwd;
  const build = await verifyCliBuild(root);
  const { stdout: currentCommit } = await execa('git', ['rev-parse', 'HEAD'], { cwd: root });
  if (currentCommit !== build.sourceCommit)
    throw new Error('The source commit changed after building the CLI.');
  const npmDirectory = join(root, 'artifacts/cli');
  const npmManifest = await readManifest(npmDirectory);
  if (npmManifest.version !== context.nextRelease.version) {
    throw new Error('semantic-release did not stamp the expected CLI version.');
  }
  const githubDirectory = join(root, 'artifacts/cli-github');
  await mkdir(join(githubDirectory, 'bin'), { recursive: true });
  const githubManifest = CliPackageManifestSchema.parse({
    ...npmManifest,
    name: '@amreetkumarkhuntia/vdclip',
  });
  for (const file of ['bin/vdclip.js', 'README.md', 'LICENSE']) {
    await copyFile(join(npmDirectory, file), join(githubDirectory, file));
  }
  await writeFile(
    join(githubDirectory, 'package.json'),
    `${JSON.stringify(githubManifest, null, 2)}\n`,
  );

  const archiveDirectory = join(root, 'artifacts/releases');
  const archives: CliReleaseArchive[] = [];
  for (const [directory, registry] of [
    [npmDirectory, 'https://registry.npmjs.org'],
    [githubDirectory, 'https://npm.pkg.github.com'],
  ] as const) {
    const archive = await packCli(directory, archiveDirectory);
    const archivePath = join(archiveDirectory, archive.filename);
    await smokeCliArchive(archivePath, await readManifest(directory), build.executableSha256);
    archives.push(
      CliReleaseArchiveSchema.parse({ ...archive, registry, sha256: await fileHash(archivePath) }),
    );
  }
  const record: CliReleaseRecord = {
    version: npmManifest.version,
    channel: context.nextRelease.channel ?? 'latest',
    sourceCommit: build.sourceCommit,
    archives,
  };
  await writeFile(join(archiveDirectory, 'release.json'), `${JSON.stringify(record, null, 2)}\n`);
  context.logger.log(
    'Verified both CLI archives for %s from %s.',
    record.version,
    record.sourceCommit,
  );
}

export async function verifyConditions(
  _options: unknown,
  context: CliReleaseContext,
): Promise<void> {
  for (const key of ['NPM_TOKEN', 'GH_PACKAGES_TOKEN']) {
    if (!context.env[key]) throw new Error(`CLI publication requires ${key}.`);
  }
  const build = await verifyCliBuild(context.cwd);
  if (build.sourceDirty) throw new Error('Build the release CLI from a clean, committed checkout.');
}

/** Skip only a byte-identical existing publication, allowing retries after one registry fails. */
async function alreadyPublished(
  archive: CliReleaseArchive,
  root: string,
  env: Record<string, string | undefined>,
): Promise<boolean> {
  const result = await execa(
    'npm',
    [
      'view',
      `${archive.name}@${archive.version}`,
      'dist.integrity',
      '--json',
      '--registry',
      archive.registry,
    ],
    {
      cwd: root,
      env,
      timeout: 60_000,
      reject: false,
    },
  );
  if (result.exitCode === 0) {
    const integrity = z.string().parse(JSON.parse(result.stdout));
    if (integrity !== archive.integrity)
      throw new Error(
        `${archive.name}@${archive.version} already exists with different contents; refusing to replace it.`,
      );
    return true;
  }
  const error = z
    .object({ error: z.object({ code: z.string() }) })
    .safeParse(parseNpmError(result.stdout));
  if (error.success && error.data.error.code === 'E404') return false;
  throw new Error(
    `Cannot check ${archive.name}@${archive.version} on ${archive.registry}; publication was not attempted.`,
  );
}

function parseNpmError(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  } // npm can return non-JSON for a network error; the caller fails closed.
}

export async function publish(_options: unknown, context: CliReleaseContext): Promise<void> {
  const archiveDirectory = join(context.cwd, 'artifacts/releases');
  const record = CliReleaseRecordSchema.parse(
    JSON.parse(await readFile(join(archiveDirectory, 'release.json'), 'utf8')),
  );
  if (record.version === '0.0.0-development')
    throw new Error('Development archives cannot be published. Use a versioned release.');
  if (record.version !== context.nextRelease.version)
    throw new Error('CLI release record has the wrong version.');
  if (record.channel !== (context.nextRelease.channel ?? 'latest'))
    throw new Error('CLI release record has the wrong distribution tag.');
  for (const archive of record.archives) {
    if (
      archive.version !== record.version ||
      (await fileHash(join(archiveDirectory, archive.filename))) !== archive.sha256
    ) {
      throw new Error('A CLI release archive changed after verification.');
    }
  }
  // Only an environment placeholder goes into npmrc. Tokens never enter an archive or log.
  const npmrc = join(context.cwd, 'artifacts/release/publish.npmrc');
  await mkdir(join(context.cwd, 'artifacts/release'), { recursive: true });
  await writeFile(
    npmrc,
    '//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\n//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n',
  );
  for (const archive of record.archives) {
    const token =
      archive.registry === 'https://registry.npmjs.org'
        ? context.env.NPM_TOKEN
        : context.env.GH_PACKAGES_TOKEN;
    if (!token) throw new Error(`Missing publication credential for ${archive.registry}.`);
    const env = { ...context.env, NODE_AUTH_TOKEN: token, NPM_CONFIG_USERCONFIG: npmrc };
    const exists = await alreadyPublished(archive, context.cwd, env);
    if (!exists) {
      await execa(
        'npm',
        [
          'publish',
          join(archiveDirectory, archive.filename),
          '--ignore-scripts',
          '--access',
          'public',
          '--registry',
          archive.registry,
          '--tag',
          context.nextRelease.channel ?? 'latest',
        ],
        {
          cwd: context.cwd,
          env,
          timeout: 120_000,
        },
      );
    }
    await writeFile(
      join(archiveDirectory, `${archive.filename}.published.json`),
      `${JSON.stringify({ name: archive.name, version: archive.version, registry: archive.registry, integrity: archive.integrity }, null, 2)}\n`,
    );
    context.logger.log(
      '%s %s@%s on %s.',
      exists ? 'Already published' : 'Published',
      archive.name,
      archive.version,
      archive.registry,
    );
  }
}
