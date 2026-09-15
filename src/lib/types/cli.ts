import { z } from 'zod';

/** The complete allowlist for the executable package, independent of the server manifest. */
export const CliPackageManifestSchema = z
  .object({
    name: z.enum(['vdclip', '@amreetkumarkhuntia/vdclip']),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?$/),
    description: z.string(),
    license: z.string(),
    author: z.string(),
    type: z.literal('module'),
    engines: z.object({ node: z.literal('>=22') }).strict(),
    bin: z.object({ vdclip: z.literal('bin/vdclip.js') }).strict(),
    files: z.tuple([z.literal('bin/vdclip.js')]),
    publishConfig: z.object({ access: z.literal('public') }).strict(),
    repository: z.object({ type: z.literal('git'), url: z.string().url() }).strict(),
    dependencies: z.object({ nanoid: z.string(), open: z.string(), zod: z.string() }).strict(),
  })
  .strict();
export type CliPackageManifest = z.infer<typeof CliPackageManifestSchema>;

export const CliBuildRecordSchema = z
  .object({
    sourceCommit: z.string().regex(/^[a-f0-9]{40,64}$/),
    sourceDirty: z.boolean(),
    executableSha256: z.string().regex(/^[a-f0-9]{64}$/),
    inputs: z.array(z.string()),
    externals: z.array(z.string()),
  })
  .strict();
export type CliBuildRecord = z.infer<typeof CliBuildRecordSchema>;

export const CliPackedArchiveSchema = z.object({
  name: z.string(),
  version: z.string(),
  filename: z.string().regex(/^[\w.-]+\.tgz$/),
  integrity: z.string().startsWith('sha512-'),
  size: z.number().int().positive(),
  unpackedSize: z.number().int().positive(),
  files: z.array(z.object({ path: z.string(), mode: z.number().int(), size: z.number().int() })),
});
export type CliPackedArchive = z.infer<typeof CliPackedArchiveSchema>;

export const CliReleaseArchiveSchema = CliPackedArchiveSchema.extend({
  name: CliPackageManifestSchema.shape.name,
  registry: z.enum(['https://registry.npmjs.org', 'https://npm.pkg.github.com']),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CliReleaseArchive = z.infer<typeof CliReleaseArchiveSchema>;

export const CliReleaseRecordSchema = z.object({
  version: z.string(),
  channel: z.string().min(1).default('latest'),
  sourceCommit: z.string(),
  archives: z
    .array(CliReleaseArchiveSchema)
    .length(2)
    .refine(
      (archives): boolean =>
        archives.some(
          (archive): boolean =>
            archive.name === 'vdclip' && archive.registry === 'https://registry.npmjs.org',
        ) &&
        archives.some(
          (archive): boolean =>
            archive.name === '@amreetkumarkhuntia/vdclip' &&
            archive.registry === 'https://npm.pkg.github.com',
        ),
      { message: 'Expected one verified archive for each configured registry.' },
    ),
});
export type CliReleaseRecord = z.infer<typeof CliReleaseRecordSchema>;

/** The semantic-release fields used by the local CLI publication plugin. */
export interface CliReleaseContext {
  cwd: string;
  env: Record<string, string | undefined>;
  nextRelease: { version: string; channel?: string };
  logger: { log: (message: string, ...args: unknown[]) => void };
}

/**
 * Parsed CLI argument shape.
 * Defined here so both `src/cli.ts` (which creates it) and
 * `src/pipeline/runner.ts` (which consumes it) share a single source of truth.
 */
export interface CliArgs {
  url: string | undefined;
  clip: boolean;
  downloadSections: 'all' | number | undefined;
  localVideo?: string;
  videoPath: string | undefined;
  threshold: number | undefined;
  topN: number | undefined;
  maxDuration: number | undefined;
  maxChunks: number | undefined;
  maxParallel: number | undefined;
  outputJson: string | undefined;
  noCache: boolean;
  noAudio: boolean;
  gameProfile?: string;
  help: boolean;
}
