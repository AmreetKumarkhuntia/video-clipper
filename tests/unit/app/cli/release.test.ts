import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliReleaseArchive, CliReleaseContext } from '@lib/types/cli.js';
import { publish } from '../../../../scripts/cliRelease.js';

vi.mock('execa', (): object => ({ execa: vi.fn() }));

let root: string;
let archives: CliReleaseArchive[];
let context: CliReleaseContext;

function commandResult(stdout: string, exitCode: number = 0): Awaited<ReturnType<typeof execa>> {
  return { stdout, exitCode } as Awaited<ReturnType<typeof execa>>;
}

beforeEach(async (): Promise<void> => {
  vi.resetAllMocks();
  root = await mkdtemp(join(tmpdir(), 'cli-release-test-'));
  await mkdir(join(root, 'artifacts/releases'), { recursive: true });
  archives = [];
  for (const [scope, registry] of [
    ['thunderkiller', 'https://registry.npmjs.org'],
    ['amreetkumarkhuntia', 'https://npm.pkg.github.com'],
  ] as const) {
    const content = Buffer.from(`verified test archive for ${scope}`);
    const filename = `${scope}-video-clipper-4.0.0.tgz`;
    await writeFile(join(root, 'artifacts/releases', filename), content);
    archives.push({
      name: `@${scope}/video-clipper`,
      version: '4.0.0',
      filename,
      registry,
      integrity: `sha512-${createHash('sha512').update(content).digest('base64')}`,
      sha256: createHash('sha256').update(content).digest('hex'),
      size: content.length,
      unpackedSize: content.length,
      files: [],
    });
  }
  await writeFile(
    join(root, 'artifacts/releases/release.json'),
    JSON.stringify({ version: '4.0.0', sourceCommit: 'abc123', archives }),
  );
  context = {
    cwd: root,
    env: { NPM_TOKEN: 'test-npm-token', GH_PACKAGES_TOKEN: 'test-gh-token' },
    nextRelease: { version: '4.0.0' },
    logger: { log: vi.fn() },
  };
});

afterEach(async (): Promise<void> => {
  await rm(root, { recursive: true, force: true });
});

describe('verified CLI archive publication', (): void => {
  it('refuses development archives before contacting a registry', async (): Promise<void> => {
    const version = '0.0.0-development';
    await writeFile(
      join(root, 'artifacts/releases/release.json'),
      JSON.stringify({
        version,
        sourceCommit: 'abc123',
        archives: archives.map((archive): CliReleaseArchive => ({ ...archive, version })),
      }),
    );
    await expect(publish({}, { ...context, nextRelease: { version } })).rejects.toThrow(
      'Development archives cannot be published',
    );
    expect(execa).not.toHaveBeenCalled();
  });
  it('refuses a changed archive before contacting either registry', async (): Promise<void> => {
    await writeFile(join(root, 'artifacts/releases', archives[1]!.filename), 'tampered');
    await expect(publish({}, context)).rejects.toThrow('changed after verification');
    expect(execa).not.toHaveBeenCalled();
  });

  it('publishes the verified archives and can retry a partially completed release', async (): Promise<void> => {
    const missing = commandResult(JSON.stringify({ error: { code: 'E404' } }), 1);
    vi.mocked(execa)
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce(commandResult('published'))
      .mockResolvedValueOnce(missing)
      .mockRejectedValueOnce(new Error('Registry unavailable'));
    await expect(publish({}, context)).rejects.toThrow('Registry unavailable');
    expect(
      JSON.parse(
        await readFile(
          join(root, 'artifacts/releases', `${archives[0]!.filename}.published.json`),
          'utf8',
        ),
      ),
    ).toMatchObject({ registry: archives[0]!.registry });

    vi.mocked(execa).mockClear();
    vi.mocked(execa)
      .mockResolvedValueOnce(commandResult(JSON.stringify(archives[0]!.integrity)))
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce(commandResult('published'));
    await publish({}, context);
    const publications = vi
      .mocked(execa)
      .mock.calls.filter((call): boolean => Array.isArray(call[1]) && call[1][0] === 'publish');
    expect(publications).toHaveLength(1);
    expect(publications[0]![1]).toContain(join(root, 'artifacts/releases', archives[1]!.filename));
    expect(publications[0]![1]).toContain('--ignore-scripts');
    expect(await readFile(join(root, 'artifacts/release/publish.npmrc'), 'utf8')).not.toContain(
      'test-gh-token',
    );
  });

  it('refuses a registry version with different contents', async (): Promise<void> => {
    vi.mocked(execa).mockResolvedValueOnce(commandResult(JSON.stringify('sha512-other')));
    await expect(publish({}, context)).rejects.toThrow('different contents');
    expect(execa).toHaveBeenCalledTimes(1);
  });

  it('does not mistake a registry outage for a missing version', async (): Promise<void> => {
    vi.mocked(execa).mockResolvedValueOnce(
      commandResult(JSON.stringify({ error: { code: 'ECONNRESET' } }), 1),
    );
    await expect(publish({}, context)).rejects.toThrow('publication was not attempted');
    expect(execa).toHaveBeenCalledTimes(1);
  });
});
