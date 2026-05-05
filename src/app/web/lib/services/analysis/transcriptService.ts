import { Cache } from '@lib/utils/cache.js';
import { createCacheBackend } from '@lib/utils/cacheFactory.js';
import { TranscriptDetector } from '@lib/services/analysis/transcript/detector.js';
import { createTranscriptChain } from '@lib/services/audio/transcriber/index.js';
import type { TranscriptChainConfig } from '@lib/services/audio/transcriber/index.js';
import type { YtDlpCookies } from '@lib/services/video/source/youtube/metadata.js';
import { TranscriptBundleSchema } from '@app/web/types/analysis.js';
import type { TranscriptBundle } from '@app/web/types/analysis.js';
import type { Config } from '@lib/types/config.js';

export async function getTranscriptBundle(videoId: string, cfg: Config): Promise<TranscriptBundle> {
  const backend = await createCacheBackend(cfg, false);
  const cache = new Cache(backend);

  const cookies: YtDlpCookies = {
    cookiesFromBrowser: cfg.YT_DLP_COOKIES_FROM_BROWSER,
    cookiesFile: cfg.YT_DLP_COOKIES_FILE,
  };

  const transcriptChainConfig: TranscriptChainConfig = {
    ...cookies,
    whisperModel: cfg.AUDIO_WHISPER_MODEL,
  };

  try {
    const detector = new TranscriptDetector(
      createTranscriptChain(cfg.TRANSCRIPT_PROVIDER, transcriptChainConfig),
      cfg.MICRO_BLOCK_SEC,
      cfg.CHUNK_LENGTH_SEC,
      cfg.CHUNK_OVERLAP_SEC,
    );
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
