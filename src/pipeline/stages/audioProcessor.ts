import { promises as fs } from 'fs';
import pLimit from 'p-limit';
import { downloadAudio } from '../../services/audioDownloader/index.js';
import { createAnalyzerChain } from '../../services/audioAnalyzers/index.js';
import { EventDetector } from '../../services/eventDetector/index.js';
import { sliceAudio } from '../../utils/sliceAudio.js';
import { buildWindows } from '../../utils/chunker.js';
import { log } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import type { Cache } from '../../utils/cache.js';
import type { AudioEvent, AudioProcessorOpts } from '../../types/index.js';

export type { AudioProcessorOpts };

/**
 * Stage 3 — Audio Processor
 *
 * Downloads audio-only WAV, slices it into chunks using the generic
 * `buildWindows` utility, runs event detection on each slice via an
 * EventDetector (constructed from the ordered provider chain in config),
 * and persists the results to cache.
 *
 * The provider chain is built once per run from `config.AUDIO_PROVIDER`
 * (e.g. "gemini,whisper") via `createAnalyzerChain`. The EventDetector
 * walks the chain in order, falling back to the next analyzer on failure.
 *
 * Returns an empty array immediately when audio detection is disabled via
 * `--no-audio` or the `AUDIO_DETECTION_ENABLED` config flag.
 */
export async function processAudio(
  videoId: string,
  duration: number,
  cache: Cache,
  opts: AudioProcessorOpts,
): Promise<AudioEvent[]> {
  const audioEnabled = config.AUDIO_DETECTION_ENABLED && !opts.noAudio;
  if (!audioEnabled) return [];

  const cached = await cache.readAudioEvents(videoId, opts.gameProfile, config.AUDIO_PROVIDER);
  if (cached) {
    log.info(`[cache hit] Audio events loaded from cache (${cached.length} events)`);
    return cached;
  }

  try {
    const audioPath =
      opts.audioPath ?? (await downloadAudio(videoId, `${config.OUTPUT_DIR}/audio`));

    const chain = createAnalyzerChain(config.AUDIO_PROVIDER);
    const detector = new EventDetector(chain);

    const providerNames = chain.map((a) => a.source).join(' → ');
    log.info(
      `Detecting audio events (chain: ${providerNames}, profile: ${opts.gameProfile}, max ${opts.maxParallel} parallel)...`,
    );

    const windows = buildWindows(duration, config.CHUNK_LENGTH_SEC, config.CHUNK_OVERLAP_SEC);
    const limit = pLimit(opts.maxParallel);

    const results = await Promise.allSettled(
      windows.map((window) =>
        limit(async () => {
          log.info(`  Processing audio chunk ${window.start}s - ${window.end}s...`);

          const cachedChunk = await cache.readAudioChunk(
            videoId,
            opts.gameProfile,
            config.AUDIO_PROVIDER,
            window.start,
            window.end,
          );
          if (cachedChunk) {
            log.info(
              `  [cache hit] Audio chunk ${window.start}s - ${window.end}s (${cachedChunk.length} events)`,
            );
            return cachedChunk;
          }

          const slicePath = await sliceAudio(
            audioPath,
            window.start,
            window.end - window.start,
            config.OUTPUT_DIR,
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
            config.AUDIO_PROVIDER,
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
          `  Audio event detection failed for chunk ${w.start}s - ${w.end}s: ${String(r.reason)}`,
        );
        return [];
      })
      .sort((a, b) => a.time - b.time);

    log.info(`Audio event detection complete: ${audioEvents.length} events found`);

    await cache.writeAudioEvents(videoId, opts.gameProfile, config.AUDIO_PROVIDER, audioEvents);
    return audioEvents;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`Audio event detection disabled due to error: ${message}`);
    return [];
  }
}
