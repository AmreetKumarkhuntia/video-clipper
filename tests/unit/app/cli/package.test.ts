import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CliPackageManifestSchema } from '@lib/types/cli.js';
import { assertArchiveContents, assertCliInputs } from '../../../../scripts/cliPackage.js';

const manifest = CliPackageManifestSchema.parse(
  JSON.parse(readFileSync('packages/cli/package.json', 'utf8')),
);

describe('CLI distribution boundaries', (): void => {
  it('rejects server dependencies and public library exports in the publish manifest', (): void => {
    expect((): unknown =>
      CliPackageManifestSchema.parse({
        ...manifest,
        dependencies: { ...manifest.dependencies, 'better-sqlite3': '*' },
      }),
    ).toThrow();
    expect((): unknown =>
      CliPackageManifestSchema.parse({ ...manifest, exports: { '.': './dist/lib/index.js' } }),
    ).toThrow();
  });

  it('rejects server code hidden in a bundle, including normalized relative paths', (): void => {
    expect((): void =>
      assertCliInputs(['src/app/cli/index.ts', 'src/lib/services/video/index.ts']),
    ).toThrow('cannot include');
    expect((): void => assertCliInputs(['src/app/cli/../api/index.ts'])).toThrow('cannot include');
    expect((): void => assertCliInputs(['node_modules/ai/index.js'])).toThrow('cannot include');
  });

  it('rejects an archive containing anything outside the executable package', (): void => {
    expect((): void =>
      assertArchiveContents(
        {
          name: manifest.name,
          version: manifest.version,
          filename: 'cli.tgz',
          integrity: 'sha512-test',
          size: 1,
          unpackedSize: 1,
          files: [
            'LICENSE',
            'README.md',
            'bin/vdclip.js',
            'package.json',
            'drizzle/schema.sql',
          ].map((path: string) => ({ path, mode: 0o644, size: 1 })),
        },
        manifest,
      ),
    ).toThrow('Unexpected CLI package contents');
  });
});
