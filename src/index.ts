import { config } from './config/index.js';
import { log } from './utils/logger.js';
import { formatSeconds } from './utils/format.js';
import { parseUrl } from './services/urlParser/index.js';
import { fetchTranscript } from './services/transcriptFetcher/index.js';
import { buildMicroBlocks, buildLLMChunks } from './services/chunkBuilder/index.js';

// Future pipeline steps (implemented in phases 3–4):
// import { extractMetadata }    from './services/metadataExtractor/index.js';
// import { analyzeChunks }      from './services/llmAnalyzer/index.js';
// import { rankSegments }       from './services/segmentRanker/index.js';
// import { refineSegments }     from './services/clipRefiner/index.js';
// import { downloadVideo }      from './services/videoDownloader/index.js';
// import { generateClips }      from './services/clipGenerator/index.js';

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
  log.info(
    `Micro-blocks: ${microBlocks.length} blocks @ ~${config.MICRO_BLOCK_SEC}s each`
  );

  // Step 4: Build LLM chunks
  const chunks = buildLLMChunks(microBlocks, config.CHUNK_LENGTH_SEC, config.CHUNK_OVERLAP_SEC);
  log.info(
    `LLM chunks: ${chunks.length} chunks @ ~${config.CHUNK_LENGTH_SEC}s with ${config.CHUNK_OVERLAP_SEC}s overlap`
  );

  if (chunks.length > 0) {
    const coverageStart = formatSeconds(chunks[0].start);
    const coverageEnd = formatSeconds(chunks[chunks.length - 1].end);
    const totalDuration = formatSeconds(chunks[chunks.length - 1].end - chunks[0].start);
    log.info(`Coverage: ${coverageStart} – ${coverageEnd} (${totalDuration} total)`);
  }

  log.info(
    `Ready for LLM analysis — ${chunks.length} chunk${chunks.length !== 1 ? 's' : ''} prepared`
  );
  log.info('(LLM analysis implemented in Phase 3)');
}

run();
