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

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const clipsFlag = args.includes('--clips');

if (!url) {
  log.error('Usage: npx tsx src/index.ts <youtube-url> [--clips]');
  log.error('Example: npx tsx src/index.ts https://youtube.com/watch?v=dQw4w9WgXcQ --clips');
  log.error('  --clips   Download the video and generate mp4 clips for each segment');
  process.exit(1);
}

log.info(`Starting video-clipper (model: ${config.LLM_MODEL})${clipsFlag ? ' [--clips enabled]' : ''}`);

async function run(): Promise<void> {
  // Step 1: Parse URL
  let videoId: string;
  try {
    videoId = parseUrl(url as string);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  log.info(`Video ID: ${videoId}`);

  // Step 2: Fetch transcript
  log.info('Fetching transcript...');
  let lines: Awaited<ReturnType<typeof fetchTranscript>>;
  try {
    lines = await fetchTranscript(videoId);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  log.info(`Transcript: ${lines.length} lines fetched`);

  // Step 3: Build micro-blocks
  const microBlocks = buildMicroBlocks(lines, config.MICRO_BLOCK_SEC);
  log.info(`Micro-blocks: ${microBlocks.length} blocks @ ~${config.MICRO_BLOCK_SEC}s each`);

  // Step 4: Build LLM chunks
  const chunks = buildLLMChunks(microBlocks, config.CHUNK_LENGTH_SEC, config.CHUNK_OVERLAP_SEC);
  log.info(
    `LLM chunks: ${chunks.length} chunks @ ~${config.CHUNK_LENGTH_SEC}s with ${config.CHUNK_OVERLAP_SEC}s overlap`
  );

  // Step 5: Extract metadata (yt-dlp → oEmbed fallback)
  log.info('Extracting video metadata...');
  let metadata: Awaited<ReturnType<typeof extractMetadata>>;
  try {
    metadata = await extractMetadata(videoId);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  log.info(
    `Metadata: "${metadata.title}" — ${metadata.duration > 0 ? formatSeconds(metadata.duration) : 'duration unknown'}`
  );

  // Step 6: LLM analysis (parallel across all chunks)
  const analyzedSegments = await analyzeChunks(chunks);

  if (analyzedSegments.length === 0) {
    log.warn('No segments returned from LLM analysis. Exiting.');
    process.exit(0);
  }

  // Step 7: Rank segments (filter, deduplicate, sort, cap)
  const rankedSegments = rankSegments(
    analyzedSegments,
    config.SCORE_THRESHOLD,
    config.TOP_N_SEGMENTS
  );
  log.info(
    `Ranked: ${rankedSegments.length} segment${rankedSegments.length !== 1 ? 's' : ''} above score threshold ${config.SCORE_THRESHOLD}`
  );

  if (rankedSegments.length === 0) {
    log.warn('No segments met the score threshold. Try lowering SCORE_THRESHOLD in .env.');
    process.exit(0);
  }

  // Step 8: Refine clip boundaries (second LLM pass)
  const refinedSegments = await refineSegments(rankedSegments, microBlocks);

  // Step 9: Output final result as JSON
  const result = {
    video_id: videoId,
    title: metadata.title,
    duration: metadata.duration,
    segments: refinedSegments,
  };

  console.log('\n' + JSON.stringify(result, null, 2));

  // Steps 10-11: Download video + generate clips (only with --clips flag)
  if (!clipsFlag) {
    log.info('Tip: run with --clips to download the video and generate mp4 clips.');
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

run();
