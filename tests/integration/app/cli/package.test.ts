import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCli, fileHash, packCli, readManifest } from '../../../../scripts/cliPackage.js';

const root = process.cwd();
let artifacts: string;
let origin: string;
const requests: string[] = [];
const server = createServer((request, response): void => {
  requests.push(request.url ?? '');
  response.setHeader('content-type', 'application/json');
  if (request.url === '/api/me') {
    response.end(
      JSON.stringify({
        customer: {
          id: 'package-test',
          email: 'cli@example.test',
          role: 'customer',
          permissions: [],
        },
      }),
    );
  } else {
    response.statusCode = 401;
    response.end(JSON.stringify({ error: 'Sign in to continue.' }));
  }
});

beforeAll(async (): Promise<void> => {
  await mkdir(join(root, 'temp'), { recursive: true });
  artifacts = await mkdtemp(join(root, 'temp/cli-package-'));
  await buildCli(root, artifacts);
  await new Promise<void>((resolve, reject): void => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address');
  origin = `http://127.0.0.1:${address.port}`;
}, 30_000);

afterAll(async (): Promise<void> => {
  if (server.listening)
    await new Promise<void>((resolve, reject): void => {
      server.close((error): void => (error ? reject(error) : resolve()));
    });
  if (artifacts) await rm(artifacts, { recursive: true, force: true });
});

async function runCli(args: string[]): Promise<Awaited<ReturnType<typeof execa>>> {
  return execa(process.execPath, [join(artifacts, 'cli/bin/vdclip.js'), ...args], {
    cwd: artifacts,
    env: { VIDEO_CLIPPER_API_URL: origin },
    timeout: 10_000,
    reject: false,
  });
}

describe('built CLI package', (): void => {
  it('prints every help page without contacting the configured backend', async (): Promise<void> => {
    const before = requests.length;
    const topLevel = await runCli(['--help']);
    expect(topLevel.exitCode).toBe(0);
    expect(topLevel.stdout).toContain('ask <url> <question>');
    for (const command of [
      'run',
      'analyze',
      'clip',
      'candidates',
      'library',
      'channel',
      'config',
      'ask',
      'login',
      'logout',
      'whoami',
    ]) {
      const result = await runCli([command, '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
    }
    expect(requests.length).toBe(before);
  }, 30_000);

  it('uses the HTTP backend and reports authentication failures from an executable bundle', async (): Promise<void> => {
    const result = await runCli(['whoami']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('cli@example.test');
    expect(requests).toContain('/api/me');
    const denied = await runCli(['library']);
    expect(denied.exitCode).toBe(1);
    expect(denied.stderr).toContain('login');
  });

  it('packs only the CLI and reads the release-stamped version without rebuilding', async (): Promise<void> => {
    const directory = join(artifacts, 'cli');
    const executable = join(directory, 'bin/vdclip.js');
    const hash = await fileHash(executable);
    const manifest = { ...(await readManifest(directory)), version: '4.0.0-test.1' };
    await writeFile(join(directory, 'package.json'), JSON.stringify(manifest));
    expect((await runCli(['--version'])).stdout).toBe(manifest.version);
    expect(await fileHash(executable)).toBe(hash);
    expect(await readFile(executable, 'utf8')).toMatch(/^#!\/usr\/bin\/env node\n/);
    const archive = await packCli(directory, join(artifacts, 'archives'));
    expect(archive.version).toBe(manifest.version);
    expect(archive.files.map((file): string => file.path).sort()).toEqual([
      'LICENSE',
      'README.md',
      'bin/vdclip.js',
      'package.json',
    ]);
  }, 30_000);
});
