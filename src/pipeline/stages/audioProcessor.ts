import { promises as fs } from 'fs';
import { downloadAudio } from '../../services/audioDownloader/index.js';
import { detectAudioEvents } from '../../services/audioEventDetector/index.js';
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
 * `buildWindows` utility, runs event detection on each slice (Gemini primary /
 * YAMNet fallback), and persists the results to cache.
 *
 * Returns an empty array immediately when audio detection is disabled via
 * `--no-audio` or the `AUDIO_DETECTION_ENABLED` config flag.
 *
 * All caching is handled internally via the injected `Cache` instance.
 */
export async function processAudio(
  videoId: string,
  duration: number,
  cache: Cache,
  opts: AudioProcessorOpts,
): Promise<AudioEvent[]> {
  const audioEnabled = config.AUDIO_DETECTION_ENABLED && !opts.noAudio;
  if (!audioEnabled) return [];

  // Cache-first
  const cached = await cache.readAudioEvents(videoId, opts.gameProfile, config.AUDIO_PROVIDER);
  if (cached) {
    log.info(`[cache hit] Audio events loaded from cache (${cached.length} events)`);
    return cached;
  }

  try {
    const audioPath = await downloadAudio(videoId, `${config.OUTPUT_DIR}/audio`);

    log.info(
      `Detecting audio events (provider: ${config.AUDIO_PROVIDER}, profile: ${opts.gameProfile})...`,
    );

    // Use the generic chunker to build time windows over the full audio duration.
    // Pass CHUNK_OVERLAP_SEC so audio windows are co-aligned with transcript LLM chunks,
    // which also use a sliding window of CHUNK_LENGTH_SEC with CHUNK_OVERLAP_SEC overlap.
    const windows = buildWindows(duration, config.CHUNK_LENGTH_SEC, config.CHUNK_OVERLAP_SEC);

    const audioEvents: AudioEvent[] = [];

    for (const window of windows) {
      log.info(`  Processing audio chunk ${window.start}s - ${window.end}s...`);
      try {
        // Per-chunk cache — avoids re-processing completed windows on retry
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
          audioEvents.push(...cachedChunk);
          continue;
        }

        const slicePath = await sliceAudio(
          audioPath,
          window.start,
          window.end - window.start,
          config.OUTPUT_DIR,
        );
        const events = await detectAudioEvents(
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

        audioEvents.push(...events);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(
          `  Audio event detection failed for chunk ${window.start}s - ${window.end}s: ${message}`,
        );
      }
    }

    log.info(`Audio event detection complete: ${audioEvents.length} events found`);

    await cache.writeAudioEvents(videoId, opts.gameProfile, config.AUDIO_PROVIDER, audioEvents);
    return audioEvents;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`Audio event detection disabled due to error: ${message}`);
    return [];
  }
}
