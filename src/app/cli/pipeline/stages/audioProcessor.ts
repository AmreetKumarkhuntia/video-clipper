import { promises as fs } from 'fs';
import pLimit from 'p-limit';
import { downloadAudio } from '@lib/services/audio/source/youtube.js';
import type { AudioDownloadConfig } from '@lib/types/downloader.js';
import { createAnalyzerChain } from '@lib/services/audio/analyzer/index.js';
import type { AnalyzerChainConfig } from '@lib/types/audio.js';
import { EventDetector } from '@lib/services/audio/processor/detector.js';
import { sliceAudio } from '@lib/services/audio/processor/slicer.js';
import type { SlicerConfig } from '@lib/types/audio.js';
import { buildWindows } from '@lib/utils/chunker.js';
import { log } from '@lib/utils/logger.js';
import type { Cache } from '@lib/utils/cache.js';
import type { AudioEvent, AudioProcessorOpts, AudioProcessorConfig } from '@lib/types/index.js';

export async function processAudio(
  videoId: string,
  duration: number,
  cache: Cache,
  opts: AudioProcessorOpts,
  procConfig: AudioProcessorConfig,
): Promise<AudioEvent[]> {
  const audioEnabled = procConfig.audioEnabled && !opts.noAudio;
  if (!audioEnabled) return [];

  const cached = await cache.readAudioEvents(videoId, opts.gameProfile, procConfig.audioProvider);
  if (cached) {
    log.info(
      'processAudio',
      `[cache hit] Audio events loaded from cache (${cached.length} events)`,
    );
    return cached;
  }

  try {
    const audioPath =
      opts.audioPath ??
      (await downloadAudio(
        videoId,
        `${procConfig.outputDir}/audio`,
        procConfig.audioDownloadConfig,
      ));

    const chain = createAnalyzerChain(procConfig.audioProvider, procConfig.analyzerChainConfig);
    const detector = new EventDetector(chain);

    const providerNames = chain.map((a) => a.source).join(' → ');
    log.info(
      'processAudio',
      `Detecting audio events (chain: ${providerNames}, profile: ${opts.gameProfile}, max ${opts.maxParallel} parallel)...`,
    );

    const windows = buildWindows(duration, procConfig.chunkLengthSec, procConfig.chunkOverlapSec);
    const limit = pLimit(opts.maxParallel);

    const results = await Promise.allSettled(
      windows.map((window) =>
        limit(async () => {
          log.info('processAudio', `  Processing audio chunk ${window.start}s - ${window.end}s...`);

          const cachedChunk = await cache.readAudioChunk(
            videoId,
            opts.gameProfile,
            procConfig.audioProvider,
            window.start,
            window.end,
          );
          if (cachedChunk) {
            log.info(
              'processAudio',
              `  [cache hit] Audio chunk ${window.start}s - ${window.end}s (${cachedChunk.length} events)`,
            );
            return cachedChunk;
          }

          const slicePath = await sliceAudio(
            audioPath,
            window.start,
            window.end - window.start,
            procConfig.outputDir,
            procConfig.slicerConfig,
          );
          const events = await detector.detect(
            slicePath,
            opts.gameProfile,
            window.start,
            window.end - window.start,
          );
          await fs.unlink(slicePath);

          await cache.writeAudioChunk(
            videoId,
            opts.gameProfile,
            procConfig.audioProvider,
            window.start,
            window.end,
            events,
          );

          return events;
        }),
      ),
    );

    const audioEvents: AudioEvent[] = results
      .flatMap((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        const w = windows[i]!;
        log.warn(
          'processAudio',
          `  Audio event detection failed for chunk ${w.start}s - ${w.end}s: ${String(r.reason)}`,
        );
        return [];
      })
      .sort((a, b) => a.time - b.time);

    log.info('processAudio', `Audio event detection complete: ${audioEvents.length} events found`);

    await cache.writeAudioEvents(videoId, opts.gameProfile, procConfig.audioProvider, audioEvents);
    return audioEvents;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn('processAudio', `Audio event detection disabled due to error: ${message}`);
    return [];
  }
}
