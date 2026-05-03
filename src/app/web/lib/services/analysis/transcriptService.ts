import { Cache } from '@lib/utils/cache.js';
import { createCacheBackend } from '@lib/utils/cacheFactory.js';
import { config } from '@lib/config/index.js';
import { TranscriptDetector } from '@lib/services/analysis/transcript/detector.js';
import { createTranscriptChain } from '@lib/services/audio/transcriber/index.js';
import { TranscriptBundleSchema } from '@app/web/types/analysis.js';
import type { TranscriptBundle } from '@app/web/types/analysis.js';

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
