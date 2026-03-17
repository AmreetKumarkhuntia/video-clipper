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
import { generateClips, organizeClips } from './services/clipGenerator/index.js';
import { downloadAudio } from './services/audioDownloader/index.js';
import { detectAudioEvents } from './services/audioEventDetector/index.js';
import { mergeSignals } from './services/signalMerger/index.js';
import { dumpTranscript, dumpAnalysis } from './utils/dumper.js';
import { formatConfig } from './utils/redactConfig.js';
import { sliceAudio } from './utils/sliceAudio.js';
import {
  readTranscriptCache,
  writeTranscriptCache,
  readAudioEventCache,
  writeAudioEventCache,
} from './utils/cache.js';
import type { PipelineResult, RankedSegment, AudioEvent, MergedCandidate } from './types/index.js';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
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

function parseArgs(argv: string[]): CliArgs {
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

function printUsage(): void {
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

if (cliArgs.localVideo && !cliArgs.clip) {
  log.error('--local-video requires --clip flag');
  printUsage();
  process.exit(1);
}

if (cliArgs.localVideo && cliArgs.downloadSections) {
  log.warn(
    '--download-sections is ignored when using --local-video (clipping all segments from --top-n)',
  );
}

const threshold = cliArgs.threshold ?? config.SCORE_THRESHOLD;
const topN = cliArgs.topN ?? config.TOP_N_SEGMENTS;
const downloadSections = cliArgs.downloadSections ?? config.DOWNLOAD_SECTIONS_MODE;
const videoPath = cliArgs.videoPath;
const gameProfile = cliArgs.gameProfile ?? config.GAME_PROFILE;

log.info(
  `Starting video-clipper (model: ${config.LLM_MODEL})${cliArgs.clip ? ' [--clip enabled]' : ''}${cliArgs.localVideo ? ` [--local-video: ${cliArgs.localVideo}]` : ''}${downloadSections !== undefined && downloadSections !== 'all' ? ` [--download-sections: ${downloadSections}]` : ''}${videoPath ? ` [--video-path: ${videoPath}]` : ''}`,
);
log.info(`Config: ${formatConfig(config)}`);

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
    `Video: "${metadata.title}" (${metadata.duration > 0 ? formatSeconds(metadata.duration) : 'duration unknown'})`,
  );

  // Step 3: --max-duration guard
  if (cliArgs.maxDuration !== undefined && metadata.duration > 0) {
    if (metadata.duration > cliArgs.maxDuration) {
      log.error(
        `Video duration exceeds --max-duration limit. ` +
          `(${formatSeconds(metadata.duration)} > ${formatSeconds(cliArgs.maxDuration)})`,
      );
      process.exit(1);
    }
  }

  // Step 4: Fetch transcript (with cache)
  log.info('Fetching transcript...');
  let lines: Awaited<ReturnType<typeof fetchTranscript>>;

  const cachedLines = cliArgs.noCache ? null : await readTranscriptCache(videoId, config.CACHE_DIR);

  if (cachedLines) {
    lines = cachedLines;
    log.info(`[cache hit] Transcript loaded from cache (${lines.length} lines)`);
  } else {
    try {
      lines = await fetchTranscript(videoId);
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    await writeTranscriptCache(videoId, lines, config.CACHE_DIR);
  }

  // Step 4a: Dump transcript (if enabled)
  if (config.DUMP_OUTPUTS) {
    await dumpTranscript(videoId, lines);
  }

  // Step 4b: Download and detect audio events (if enabled)
  let audioEvents: AudioEvent[] = [];
  const audioEnabled = config.AUDIO_DETECTION_ENABLED && !cliArgs.noAudio;
  if (audioEnabled) {
    const cachedEvents = cliArgs.noCache
      ? null
      : await readAudioEventCache(videoId, gameProfile, config.AUDIO_PROVIDER, config.CACHE_DIR);

    if (cachedEvents) {
      audioEvents = cachedEvents;
      log.info(`[cache hit] Audio events loaded from cache (${audioEvents.length} events)`);
    } else {
      try {
        const audioPath = await downloadAudio(videoId, config.OUTPUT_DIR + '/audio');

        log.info(
          `Detecting audio events (provider: ${config.AUDIO_PROVIDER}, profile: ${gameProfile})...`,
        );
        const chunkLength = config.CHUNK_LENGTH_SEC;
        const audioDuration = metadata.duration;

        for (let offset = 0; offset < audioDuration; offset += chunkLength) {
          const chunkOffset = offset;
          const chunkEnd = Math.min(offset + chunkLength, audioDuration);

          log.info(`  Processing audio chunk ${offset}s - ${chunkEnd}s...`);

          try {
            const slicePath = await sliceAudio(
              audioPath,
              offset,
              chunkEnd - offset,
              config.OUTPUT_DIR,
            );
            const events = await detectAudioEvents(slicePath, gameProfile, chunkOffset);
            await fs.unlink(slicePath);
            audioEvents.push(...events);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log.warn(
              `  Audio event detection failed for chunk ${offset}s - ${chunkEnd}s: ${message}`,
            );
          }
        }

        log.info(`Audio event detection complete: ${audioEvents.length} events found`);

        await writeAudioEventCache(
          videoId,
          gameProfile,
          config.AUDIO_PROVIDER,
          audioEvents,
          config.CACHE_DIR,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`Audio event detection disabled due to error: ${message}`);
        audioEvents = [];
      }
    }
  }

  // Step 5: Build micro-blocks and LLM chunks
  const microBlocks = buildMicroBlocks(lines, config.MICRO_BLOCK_SEC);
  const chunks = buildLLMChunks(microBlocks, config.CHUNK_LENGTH_SEC, config.CHUNK_OVERLAP_SEC);
  log.info(
    `Transcript: ${lines.length} lines → ${microBlocks.length} micro-blocks → ${chunks.length} chunks`,
  );

  // Step 6: LLM analysis (parallel across all chunks)
  const chunkLimit = cliArgs.maxChunks ?? config.MAX_CHUNKS;
  const chunksToAnalyze = chunkLimit !== undefined ? chunks.slice(0, chunkLimit) : chunks;
  if (chunkLimit !== undefined) {
    log.info(
      `Limiting evaluation to ${chunksToAnalyze.length} of ${chunks.length} chunks (--max-chunks ${chunkLimit})`,
    );
  }
  log.info(
    `Analyzing chunks with ${config.LLM_MODEL} (${chunksToAnalyze.length} chunks, max ${cliArgs.maxParallel ?? config.LLM_CONCURRENCY} parallel)...`,
  );
  const chunkEvaluations = await analyzeChunks(
    chunksToAnalyze,
    cliArgs.maxParallel ?? config.LLM_CONCURRENCY,
    cliArgs.noCache,
  );
  const succeededCount = chunkEvaluations.filter((e) => e.status === 'success').length;

  if (succeededCount === 0) {
    log.error('All chunks failed LLM analysis. Check your API key and model config.');
    process.exit(1);
  }

  // Step 7: Merge transcript and audio signals
  const mergedCandidates = mergeSignals(chunkEvaluations, audioEvents);

  // Step 8: Rank segments
  const rankedSegments = rankSegments(mergedCandidates, threshold, topN);

  if (rankedSegments.length === 0) {
    log.warn(`No segments scored above threshold ${threshold}. Try lowering --threshold.`);
    const emptyResult: PipelineResult = {
      video_id: videoId,
      title: metadata.title,
      duration: metadata.duration,
      chunk_evaluations: chunkEvaluations,
      segments: [],
    };
    await outputResult(emptyResult, cliArgs.outputJson);
    if (config.DUMP_OUTPUTS) {
      await dumpAnalysis(videoId, emptyResult);
    }
    process.exit(0);
  }

  log.info(
    `Analysis complete: ${rankedSegments.length} segment${rankedSegments.length !== 1 ? 's' : ''} above threshold ${threshold}`,
  );

  // Step 9: Refine clip boundaries (second LLM pass)
  log.info('Refining clip boundaries...');
  const refinedSegments = await refineSegments(
    rankedSegments,
    microBlocks,
    cliArgs.maxParallel ?? config.LLM_CONCURRENCY,
    cliArgs.noCache,
  );

  // Step 10: Output final result
  const result: PipelineResult = {
    video_id: videoId,
    title: metadata.title,
    duration: metadata.duration,
    chunk_evaluations: chunkEvaluations,
    segments: refinedSegments,
  };

  await outputResult(result, cliArgs.outputJson);

  // Step 10a: Dump analysis (if enabled)
  if (config.DUMP_OUTPUTS) {
    await dumpAnalysis(videoId, result);
  }

  log.info('Done.');

  // Steps 11-12: Download video + generate clips (only with --clip flag)
  if (!cliArgs.clip) {
    log.info('Tip: run with --clip to download the video and generate mp4 clips.');
    return;
  }

  // Step 11: Download video or use local file
  let downloadResult: Awaited<ReturnType<typeof downloadVideo>> | undefined;
  let localVideoPath: string | undefined;

  if (cliArgs.localVideo) {
    localVideoPath = cliArgs.localVideo;
  } else {
    let segmentsToDownload: RankedSegment[] = refinedSegments;
    let downloadMode: 'all' | 'segments' = 'all';

    if (typeof downloadSections === 'number') {
      downloadMode = 'segments';
      segmentsToDownload = refinedSegments.slice(0, downloadSections);

      if (segmentsToDownload.length < downloadSections) {
        log.warn(
          `Requested ${downloadSections} segments, but only ${segmentsToDownload.length} are available above threshold.`,
        );
      }
    } else if (downloadSections === 'all') {
      downloadMode = 'all';
    }

    log.info(`Downloading video (${downloadMode} mode)...`);
    try {
      downloadResult = await downloadVideo(videoId, downloadMode, segmentsToDownload, videoPath);
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  // Step 12: Generate clips via ffmpeg or organize pre-downloaded segments
  let clipPaths: string[];

  if (localVideoPath) {
    try {
      clipPaths = await generateClips(
        localVideoPath,
        refinedSegments,
        videoId,
        videoPath,
        config.CLIP_CONCURRENCY,
      );
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  } else if (downloadResult!.mode === 'segments') {
    try {
      clipPaths = await organizeClips(
        downloadResult!.paths,
        videoId,
        videoPath,
        config.CLIP_CONCURRENCY,
      );
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  } else {
    try {
      clipPaths = await generateClips(
        downloadResult!.path,
        refinedSegments,
        videoId,
        videoPath,
        config.CLIP_CONCURRENCY,
      );
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
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

async function outputResult(
  result: PipelineResult,
  outputJsonPath: string | undefined,
): Promise<void> {
  const json = JSON.stringify(result, null, 2);
  if (outputJsonPath) {
    await fs.writeFile(outputJsonPath, json, 'utf-8');
    log.info(`Output written to ${outputJsonPath}`);
  } else {
    console.log('\n' + json);
  }
}

run();
