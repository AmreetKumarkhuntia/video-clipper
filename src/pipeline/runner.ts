import { promises as fs } from 'fs';
import { config } from '../config/index.js';
import { Cache } from '../utils/cache.js';
import { createCacheBackend } from '../utils/cacheFactory.js';
import { log } from '../utils/logger.js';
import { dumpAnalysis, dumpTranscript } from './dumper.js';
import { resolveVideo } from './stages/videoResolver.js';
import { processAudio } from './stages/audioProcessor.js';
import { analyzeSegments, refineRankedSegments } from './stages/segmentAnalyzer.js';
import { selectSegments } from './stages/segmentSelector.js';
import { exportClips } from './stages/clipExporter.js';
import { downloadAudio } from '../services/audioDownloader/index.js';
import type { CliArgs, PipelineResult } from '../types/index.js';

async function outputResult(
  result: PipelineResult,
  outputJsonPath: string | undefined,
): Promise<void> {
  const json = JSON.stringify(result, null, 2);
  if (outputJsonPath) {
    await fs.writeFile(outputJsonPath, json, 'utf-8');
    log.info(`Output written to ${outputJsonPath}`);
  } else {
    console.log('\n' + json);
  }
}

/**
 * Runs the full video-clipper pipeline for the given CLI arguments.
 *
 * Stage ordering:
 *   1. resolveVideo         — parse URL, extract video ID + metadata
 *   2. downloadAudio        — download WAV so Whisper/Gemini transcript providers can use it
 *   3. processAudio         — detect audio events per window (reuses downloaded WAV)
 *   4a. analyzeSegments     — fetch transcript + LLM pass 1 (informed by audio events)
 *   5. selectSegments       — merge signals, rank, threshold filter
 *   4b. refineRankedSegments — LLM pass 2 to tighten clip boundaries
 *   6. exportClips          — download video + run ffmpeg (only if --clip)
 *
 * downloadAudio runs before analyzeSegments so that `audioPath` is available
 * for Whisper/Gemini transcript providers. processAudio reuses the same WAV.
 *
 * Hard errors (invalid URL, transcript failure, all LLM chunks failed) are
 * thrown so the caller can catch, log, and exit(1). Soft failures (audio
 * detection, individual clip failures) are logged as warnings and the pipeline
 * continues.
 */
export async function runPipeline(args: CliArgs): Promise<void> {
  const threshold = args.threshold ?? config.SCORE_THRESHOLD;
  const topN = args.topN ?? config.TOP_N_SEGMENTS;
  const gameProfile = args.gameProfile ?? config.GAME_PROFILE;
  const maxParallel = args.maxParallel ?? config.LLM_CONCURRENCY;

  const backend = await createCacheBackend(config, args.noCache);
  const cache = new Cache(backend);
  try {
    const { videoId, metadata } = await resolveVideo(args.url as string, args.maxDuration);

    /** Downloaded before transcript so Whisper/Gemini transcript providers can
     * use the WAV. Returns null when audio detection is disabled.
     */
    let audioPath: string | null = null;
    const audioEnabled = config.AUDIO_DETECTION_ENABLED && !args.noAudio;
    if (audioEnabled) {
      try {
        audioPath = await downloadAudio(videoId, `${config.OUTPUT_DIR}/audio`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`Audio download failed — continuing without audio: ${message}`);
      }
    }

    const audioEvents = await processAudio(videoId, metadata.duration, cache, {
      noAudio: args.noAudio,
      gameProfile,
      maxParallel,
      audioPath,
    });

    const { lines, microBlocks, chunkEvals } = await analyzeSegments(
      videoId,
      audioPath,
      audioEvents,
      cache,
      {
        maxChunks: args.maxChunks,
        maxParallel,
        noCache: args.noCache,
      },
    );

    if (config.DUMP_OUTPUTS) {
      await dumpTranscript(videoId, lines);
    }

    const rankedSegments = selectSegments(chunkEvals, audioEvents, { threshold, topN });

    const partialResult: PipelineResult = {
      video_id: videoId,
      title: metadata.title,
      duration: metadata.duration,
      chunk_evaluations: chunkEvals,
      segments: rankedSegments,
    };

    if (rankedSegments.length === 0) {
      await outputResult(partialResult, args.outputJson);
      if (config.DUMP_OUTPUTS) await dumpAnalysis(videoId, partialResult);
      return;
    }

    const refinedSegments = await refineRankedSegments(rankedSegments, microBlocks, cache, {
      maxParallel,
      noCache: args.noCache,
    });

    const result: PipelineResult = {
      video_id: videoId,
      title: metadata.title,
      duration: metadata.duration,
      chunk_evaluations: chunkEvals,
      segments: refinedSegments,
    };

    await outputResult(result, args.outputJson);
    if (config.DUMP_OUTPUTS) await dumpAnalysis(videoId, result);

    log.info('Done.');

    if (!args.clip) {
      log.info('Tip: run with --clip to download the video and generate mp4 clips.');
      return;
    }

    const clipPaths = await exportClips(videoId, refinedSegments, {
      localVideo: args.localVideo,
      downloadSections: args.downloadSections,
      videoPath: args.videoPath,
    });

    if (clipPaths.length === 0) {
      log.warn('No clips were generated successfully.');
    } else {
      log.info(`Done — ${clipPaths.length} clip${clipPaths.length !== 1 ? 's' : ''} saved:`);
      for (const p of clipPaths) {
        log.info(`  ${p}`);
      }
    }
  } finally {
    await cache.close();
  }
}
