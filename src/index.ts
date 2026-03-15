import { config } from './config/index.js';
import { log } from './utils/logger.js';

const url = process.argv[2];

if (!url) {
  log.error('Usage: npx tsx src/index.ts <youtube-url> [--clip]');
  log.error('Example: npx tsx src/index.ts https://youtube.com/watch?v=dQw4w9WgXcQ');
  process.exit(1);
}

// Config is validated at import time — if OPENAI_API_KEY is missing, process exits above.
log.info(`Starting video-clipper (model: ${config.LLM_MODEL})`);
log.info(`Input URL: ${url}`);
log.info('Pipeline not yet implemented — see docs/phases/phase-2.md');

// Future pipeline steps (implemented in phases 2–4):
// import { parseUrl }           from './services/urlParser/index.js';
// import { extractMetadata }    from './services/metadataExtractor/index.js';
// import { fetchTranscript }    from './services/transcriptFetcher/index.js';
// import { buildMicroBlocks, buildLLMChunks } from './services/chunkBuilder/index.js';
// import { analyzeChunks }      from './services/llmAnalyzer/index.js';
// import { rankSegments }       from './services/segmentRanker/index.js';
// import { refineSegments }     from './services/clipRefiner/index.js';
// import { downloadVideo }      from './services/videoDownloader/index.js';
// import { generateClips }      from './services/clipGenerator/index.js';
