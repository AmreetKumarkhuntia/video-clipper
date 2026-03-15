import { promises as fs } from 'fs';
import { config } from './config/index.js';
import { log } from './utils/logger.js';
import { formatSeconds } from './utils/format.js';
import { parseUrl } from './services/urlParser/index.js';
import { fetchTranscript } from './services/transcriptFetcher/index.js';
import { buildMicroBlocks, buildLLMChunks } from './services/chunkBuilder/index.js';
import { extractMetadata } from './services/metadataExtractor/index.js';
import { analyzeChunks } from './services/llmAnalyzer/index.js';
import { rankSegments } from './services/segmentRanker/index.js';
import { refineSegments } from './services/clipRefiner/index.js';
import { downloadVideo } from './services/videoDownloader/index.js';
import { generateClips } from './services/clipGenerator/index.js';
import type { PipelineResult } from './types/index.js';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  url: string | undefined;
  clip: boolean;
  threshold: number | undefined;
  topN: number | undefined;
  maxDuration: number | undefined;
  outputJson: string | undefined;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const result: CliArgs = {
    url: undefined,
    clip: false,
    threshold: undefined,
    topN: undefined,
    maxDuration: undefined,
    outputJson: undefined,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--clip') {
      result.clip = true;
    } else if (arg === '--threshold') {
      const val = Number(args[++i]);
      if (isNaN(val)) { log.error(`--threshold requires a numeric value`); process.exit(1); }
      result.threshold = val;
    } else if (arg === '--top-n') {
      const val = Number(args[++i]);
      if (isNaN(val)) { log.error(`--top-n requires a numeric value`); process.exit(1); }
      result.topN = val;
    } else if (arg === '--max-duration') {
      const val = Number(args[++i]);
      if (isNaN(val)) { log.error(`--max-duration requires a numeric value`); process.exit(1); }
      result.maxDuration = val;
    } else if (arg === '--output-json') {
      result.outputJson = args[++i];
      if (!result.outputJson) { log.error(`--output-json requires a file path`); process.exit(1); }
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

function printUsage(): void {
  console.log(`
Usage: npx tsx src/index.ts <youtube-url> [options]

Arguments:
  <youtube-url>           YouTube video URL (required)

Options:
  --clip                  Download video and generate mp4 clips for each segment
  --threshold <n>         Minimum score to keep a segment (default: ${config.SCORE_THRESHOLD})
  --top-n <n>             Maximum number of segments to return (default: ${config.TOP_N_SEGMENTS})
  --max-duration <s>      Abort if video is longer than <s> seconds
  --output-json <path>    Write output JSON to file instead of stdout
  --help, -h              Show this help message

Examples:
  npx tsx src/index.ts https://youtube.com/watch?v=dQw4w9WgXcQ
  npx tsx src/index.ts https://youtu.be/dQw4w9WgXcQ --clip
  npx tsx src/index.ts https://youtube.com/watch?v=dQw4w9WgXcQ --threshold 8 --top-n 5
  npx tsx src/index.ts https://youtube.com/watch?v=dQw4w9WgXcQ --output-json results.json
`.trim());
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

const cliArgs = parseArgs(process.argv);

if (cliArgs.help) {
  printUsage();
  process.exit(0);
}

if (!cliArgs.url) {
  log.error('No YouTube URL provided.');
  printUsage();
  process.exit(1);
}

const threshold = cliArgs.threshold ?? config.SCORE_THRESHOLD;
const topN = cliArgs.topN ?? config.TOP_N_SEGMENTS;

log.info(`Starting video-clipper (model: ${config.LLM_MODEL})${cliArgs.clip ? ' [--clip enabled]' : ''}`);

async function run(): Promise<void> {
  // Step 1: Parse URL
  let videoId: string;
  try {
    videoId = parseUrl(cliArgs.url as string);
  } catch (err) {
    log.error(`Invalid YouTube URL: ${cliArgs.url}`);
    process.exit(1);
  }

  // Step 2: Extract metadata
  log.info(`Fetching metadata for ${videoId}...`);
  let metadata: Awaited<ReturnType<typeof extractMetadata>>;
  try {
    metadata = await extractMetadata(videoId);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  log.info(
    `Video: "${metadata.title}" (${metadata.duration > 0 ? formatSeconds(metadata.duration) : 'duration unknown'})`
  );

  // Step 3: --max-duration guard
  if (cliArgs.maxDuration !== undefined && metadata.duration > 0) {
    if (metadata.duration > cliArgs.maxDuration) {
      log.error(
        `Video duration exceeds --max-duration limit. ` +
        `(${formatSeconds(metadata.duration)} > ${formatSeconds(cliArgs.maxDuration)})`
      );
      process.exit(1);
    }
  }

  // Step 4: Fetch transcript
  log.info('Fetching transcript...');
  let lines: Awaited<ReturnType<typeof fetchTranscript>>;
  try {
    lines = await fetchTranscript(videoId);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Step 5: Build micro-blocks and LLM chunks
  const microBlocks = buildMicroBlocks(lines, config.MICRO_BLOCK_SEC);
  const chunks = buildLLMChunks(microBlocks, config.CHUNK_LENGTH_SEC, config.CHUNK_OVERLAP_SEC);
  log.info(
    `Transcript: ${lines.length} lines → ${microBlocks.length} micro-blocks → ${chunks.length} chunks`
  );

  // Step 6: LLM analysis (parallel across all chunks)
  log.info(`Analyzing chunks with ${config.LLM_MODEL} (${chunks.length} parallel calls)...`);
  const analyzedSegments = await analyzeChunks(chunks);

  if (analyzedSegments.length === 0) {
    log.error('All chunks failed LLM analysis. Check your API key and model config.');
    process.exit(1);
  }

  // Step 7: Rank segments
  const rankedSegments = rankSegments(analyzedSegments, threshold, topN);

  if (rankedSegments.length === 0) {
    log.warn(`No segments scored above threshold ${threshold}. Try lowering --threshold.`);
    const emptyResult: PipelineResult = {
      video_id: videoId,
      title: metadata.title,
      duration: metadata.duration,
      segments: [],
    };
    await outputResult(emptyResult, cliArgs.outputJson);
    process.exit(0);
  }

  log.info(`Analysis complete: ${rankedSegments.length} segment${rankedSegments.length !== 1 ? 's' : ''} above threshold ${threshold}`);

  // Step 8: Refine clip boundaries (second LLM pass)
  log.info('Refining clip boundaries...');
  const refinedSegments = await refineSegments(rankedSegments, microBlocks);

  // Step 9: Output final result
  const result: PipelineResult = {
    video_id: videoId,
    title: metadata.title,
    duration: metadata.duration,
    segments: refinedSegments,
  };

  await outputResult(result, cliArgs.outputJson);
  log.info('Done.');

  // Steps 10-11: Download video + generate clips (only with --clip flag)
  if (!cliArgs.clip) {
    log.info('Tip: run with --clip to download the video and generate mp4 clips.');
    return;
  }

  // Step 10: Download video via yt-dlp
  log.info('Downloading video...');
  let videoPath: string;
  try {
    videoPath = await downloadVideo(videoId);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Step 11: Generate clips via ffmpeg
  log.info(`Generating ${refinedSegments.length} clip${refinedSegments.length !== 1 ? 's' : ''}...`);
  let clipPaths: string[];
  try {
    clipPaths = await generateClips(videoPath, refinedSegments, videoId);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (clipPaths.length === 0) {
    log.warn('No clips were generated successfully.');
  } else {
    log.info(`Done — ${clipPaths.length} clip${clipPaths.length !== 1 ? 's' : ''} saved:`);
    for (const p of clipPaths) {
      log.info(`  ${p}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Output helper
// ---------------------------------------------------------------------------

async function outputResult(result: PipelineResult, outputJsonPath: string | undefined): Promise<void> {
  const json = JSON.stringify(result, null, 2);
  if (outputJsonPath) {
    await fs.writeFile(outputJsonPath, json, 'utf-8');
    log.info(`Output written to ${outputJsonPath}`);
  } else {
    console.log('\n' + json);
  }
}

run();
