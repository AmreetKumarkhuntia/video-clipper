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

// Future pipeline steps (implemented in Phase 4):
// import { downloadVideo }  from './services/videoDownloader/index.js';
// import { generateClips }  from './services/clipGenerator/index.js';

const url = process.argv[2];

if (!url) {
  log.error('Usage: npx tsx src/index.ts <youtube-url>');
  log.error('Example: npx tsx src/index.ts https://youtube.com/watch?v=dQw4w9WgXcQ');
  process.exit(1);
}

log.info(`Starting video-clipper (model: ${config.LLM_MODEL})`);

async function run(): Promise<void> {
  // Step 1: Parse URL
  let videoId: string;
  try {
    videoId = parseUrl(url);
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
}

run();
