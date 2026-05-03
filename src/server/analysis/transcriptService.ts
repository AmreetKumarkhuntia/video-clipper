import { Cache } from '../../utils/cache.js';
import { createCacheBackend } from '../../utils/cacheFactory.js';
import { config } from '../../config/index.js';
import { TranscriptDetector } from '../../services/transcriptDetector/index.js';
import { createTranscriptChain } from '../../services/transcriptAnalyzers/index.js';
import { TranscriptBundleSchema } from '../../types/index.js';
import type { TranscriptBundle } from '../../types/index.js';

export async function getTranscriptBundle(videoId: string): Promise<TranscriptBundle> {
  const backend = await createCacheBackend(config, false);
  const cache = new Cache(backend);

  try {
    const detector = new TranscriptDetector(createTranscriptChain(config.TRANSCRIPT_PROVIDER));
    const { lines, microBlocks, chunks } = await detector.detect(videoId, null, cache);

    return TranscriptBundleSchema.parse({
      videoId,
      lines,
      microBlocks,
      chunks,
      fetchedAt: new Date().toISOString(),
    });
  } finally {
    await cache.close();
  }
}
