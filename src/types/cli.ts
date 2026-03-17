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
