import { config } from './config/index.js';
import { log } from './utils/logger.js';
import type { CliArgs } from './types/index.js';

export type { CliArgs };

// ---------------------------------------------------------------------------
// Argument parser
// ---------------------------------------------------------------------------

export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const result: CliArgs = {
    url: undefined,
    clip: false,
    downloadSections: undefined,
    videoPath: undefined,
    threshold: undefined,
    topN: undefined,
    maxDuration: undefined,
    maxChunks: undefined,
    maxParallel: undefined,
    outputJson: undefined,
    noCache: false,
    noAudio: false,
    gameProfile: undefined,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--clip') {
      result.clip = true;
    } else if (arg === '--download-sections') {
      const val = args[++i];
      if (!val) {
        log.error(`--download-sections requires a value: 'all' or a number (1, 2, 3, ...)`);
        process.exit(1);
      }

      if (val === 'all') {
        result.downloadSections = 'all';
      } else if (val === 'segments') {
        log.warn(
          `--download-sections segments is deprecated. Use a number like --download-sections 5 to download top 5 segments, or --download-sections all for full video.`,
        );
        result.downloadSections = 'all';
      } else {
        const num = Number(val);
        if (isNaN(num) || !Number.isInteger(num) || num < 1) {
          log.error(`--download-sections requires 'all' or a positive integer (1, 2, 3, ...)`);
          process.exit(1);
        }
        result.downloadSections = num;
      }

      result.clip = true;
    } else if (arg === '--video-path') {
      const val = args[++i];
      if (!val) {
        log.error(`--video-path requires a directory path`);
        process.exit(1);
      }
      result.videoPath = val;
    } else if (arg === '--local-video') {
      const val = args[++i];
      if (!val) {
        log.error(`--local-video requires a file path`);
        process.exit(1);
      }
      result.localVideo = val;
      result.clip = true;
    } else if (arg === '--no-cache') {
      result.noCache = true;
    } else if (arg === '--threshold') {
      const val = Number(args[++i]);
      if (isNaN(val)) {
        log.error(`--threshold requires a numeric value`);
        process.exit(1);
      }
      result.threshold = val;
    } else if (arg === '--top-n') {
      const val = Number(args[++i]);
      if (isNaN(val)) {
        log.error(`--top-n requires a numeric value`);
        process.exit(1);
      }
      result.topN = val;
    } else if (arg === '--max-duration') {
      const val = Number(args[++i]);
      if (isNaN(val)) {
        log.error(`--max-duration requires a numeric value`);
        process.exit(1);
      }
      result.maxDuration = val;
    } else if (arg === '--max-chunks') {
      const val = Number(args[++i]);
      if (isNaN(val) || !Number.isInteger(val) || val < 1) {
        log.error(`--max-chunks requires a positive integer`);
        process.exit(1);
      }
      result.maxChunks = val;
    } else if (arg === '--max-parallel') {
      const val = Number(args[++i]);
      if (isNaN(val) || !Number.isInteger(val) || val < 1) {
        log.error(`--max-parallel requires a positive integer`);
        process.exit(1);
      }
      result.maxParallel = val;
    } else if (arg === '--no-audio') {
      result.noAudio = true;
    } else if (arg === '--game-profile') {
      const val = args[++i];
      if (!val) {
        log.error(`--game-profile requires a value (valorant, fps, boss_fight, general)`);
        process.exit(1);
      }
      result.gameProfile = val;
    } else if (arg === '--output-json') {
      result.outputJson = args[++i];
      if (!result.outputJson) {
        log.error(`--output-json requires a file path`);
        process.exit(1);
      }
    } else if (!arg.startsWith('--')) {
      result.url = arg;
    } else {
      log.error(`Unknown flag: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Usage text
// ---------------------------------------------------------------------------

export function printUsage(): void {
  console.log(
    `
Usage: npm run start -- <youtube-url> [options]
       npx tsx src/index.ts <youtube-url> [options]

Note: when invoking via npm run, use -- to pass flags to the script:
  npm run start -- <url> --max-chunks 3

Arguments:
  <youtube-url>           YouTube video URL (required)

Options:
  --clip                  Download video and generate mp4 clips for each segment
  --download-sections <mode>  yt-dlp download mode: 'all' (full video) or N (top N segments only, e.g. 1, 2, 3...) (default: ${config.DOWNLOAD_SECTIONS_MODE})
  --local-video <path>    Path to local video file (skips yt-dlp download, requires --clip)
  --video-path <path>     Custom output directory for downloaded videos and clips (overrides DOWNLOAD_DIR/OUTPUT_DIR)
  --threshold <n>         Minimum score to keep a segment (default: ${config.SCORE_THRESHOLD})
  --top-n <n>             Maximum number of segments to return (default: ${config.TOP_N_SEGMENTS})
  --max-duration <s>      Abort if video is longer than <s> seconds
  --max-chunks <n>        Limit the number of transcript chunks sent to the LLM (useful for testing/cost control)
  --max-parallel <n>      Max number of LLM calls to run in parallel (default: LLM_CONCURRENCY env, or 3)
  --output-json <path>    Write output JSON to file instead of stdout
  --no-cache              Bypass all caches and force a fresh run (transcript + chunk LLM results)
  --no-audio             Disable audio event detection (transcript-only mode)
  --game-profile <type>   Game profile: valorant, fps, boss_fight, general (default: ${config.GAME_PROFILE})
  --help, -h              Show this help message

Examples:
  npm run start -- https://youtube.com/watch?v=dQw4w9WgXcQ
  npm run start -- https://youtu.be/dQw4w9WgXcQ --clip
  npm run start -- https://youtube.com/watch?v=dQw4w9WgXcQ --download-sections all
  npm run start -- https://youtube.com/watch?v=dQw4w9WgXcQ --download-sections 3
  npm run start -- https://youtube.com/watch?v=dQw4w9WgXcQ --download-sections 5 --video-path ./my-clips
  npm run start -- https://youtube.com/watch?v=dQw4w9WgXcQ --local-video ./downloads/dQw4w9WgXcQ.mp4
  npm run start -- https://youtube.com/watch?v=dQw4w9WgXcQ --local-video /path/to/video.mp4 --top-n 5
  npm run start -- https://youtube.com/watch?v=dQw4w9WgXcQ --threshold 8 --top-n 5
  npm run start -- https://youtube.com/watch?v=dQw4w9WgXcQ --output-json results.json
  npm run start -- https://youtube.com/watch?v=dQw4w9WgXcQ --max-chunks 3
  npm run start -- https://youtube.com/watch?v=dQw4w9WgXcQ --max-parallel 5
`.trim(),
  );
}
