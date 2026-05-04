import { promises as fs } from 'fs';
import { config } from '@lib/config/index.js';
import { Cache } from '@lib/utils/cache.js';
import { createCacheBackend } from '@lib/utils/cacheFactory.js';
import { log } from '@lib/utils/logger.js';
import { getModel } from '@lib/utils/modelFactory.js';
import { dumpAnalysis, dumpTranscript } from './dumper.js';
import { resolveVideo } from './stages/videoResolver.js';
import { processAudio } from './stages/audioProcessor.js';
import type { AudioProcessorConfig } from './stages/audioProcessor.js';
import { analyzeSegments, refineRankedSegments } from '@lib/pipeline/stages/segmentAnalyzer.js';
import { selectSegments } from '@lib/pipeline/stages/segmentSelector.js';
import { exportClips } from '@lib/pipeline/stages/clipExporter.js';
import type { ClipExporterConfig } from '@lib/pipeline/stages/clipExporter.js';
import { downloadAudio } from '@lib/services/audio/source/youtube.js';
import type { AudioDownloadConfig } from '@lib/services/audio/source/youtube.js';
import type { ClipperConfig } from '@lib/services/video/clipper/index.js';
import type { DownloaderConfig } from '@lib/services/video/source/youtube/downloader.js';
import type { SlicerConfig } from '@lib/services/audio/processor/slicer.js';
import type { AnalyzerChainConfig } from '@lib/services/audio/analyzer/index.js';
import type { YtDlpCookies } from '@lib/services/video/source/youtube/metadata.js';
import type { TranscriptChainConfig } from '@lib/services/audio/transcriber/index.js';
import type { CliArgs, PipelineResult } from '@lib/types/index.js';

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

  const cookies: YtDlpCookies = {
    cookiesFromBrowser: config.YT_DLP_COOKIES_FROM_BROWSER,
    cookiesFile: config.YT_DLP_COOKIES_FILE,
  };

  const audioDownloadConfig: AudioDownloadConfig = {
    ...cookies,
    ffmpegPath: config.FFMPEG_PATH,
  };

  const slicerConfig: SlicerConfig = {
    ffmpegPath: config.FFMPEG_PATH,
    ffprobePath: config.FFPROBE_PATH,
  };

  const clipperConfig: ClipperConfig = {
    ffmpegPath: config.FFMPEG_PATH,
    ffprobePath: config.FFPROBE_PATH,
    timestampOffset: config.TIMESTAMP_OFFSET_SECONDS,
    ffmpegPreset: config.FFMPEG_PRESET,
    outputDir: config.OUTPUT_DIR,
  };

  const downloaderConfig: DownloaderConfig = {
    ...cookies,
    downloadDir: config.DOWNLOAD_DIR,
    timestampOffset: config.TIMESTAMP_OFFSET_SECONDS,
    llmConcurrency: config.LLM_CONCURRENCY,
  };

  const analyzerChainConfig: AnalyzerChainConfig = {
    confidenceThreshold: config.AUDIO_CONFIDENCE_THRESHOLD,
    whisperModel: config.AUDIO_WHISPER_MODEL,
    gemini: {
      apiKey: config.GOOGLE_GENERATIVE_AI_API_KEY!,
      model: config.AUDIO_GEMINI_MODEL,
      extraInstructions: config.AUDIO_EXTRA_INSTRUCTIONS,
    },
  };

  const transcriptChainConfig: TranscriptChainConfig = {
    ...cookies,
    whisperModel: config.AUDIO_WHISPER_MODEL,
  };

  const model = getModel(config.LLM_PROVIDER, config.LLM_MODEL, {
    ZAI_API_KEY: config.ZAI_API_KEY,
    OPENROUTER_API_KEY: config.OPENROUTER_API_KEY,
    CUSTOM_OPENAI_BASE_URL: config.CUSTOM_OPENAI_BASE_URL,
    CUSTOM_OPENAI_API_KEY: config.CUSTOM_OPENAI_API_KEY,
  });

  const backend = await createCacheBackend(config, args.noCache);
  const cache = new Cache(backend);
  try {
    const { videoId, metadata } = await resolveVideo(args.url as string, args.maxDuration, cookies);

    let audioPath: string | null = null;
    const audioEnabled = config.AUDIO_DETECTION_ENABLED && !args.noAudio;
    if (audioEnabled) {
      try {
        audioPath = await downloadAudio(videoId, `${config.OUTPUT_DIR}/audio`, audioDownloadConfig);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`Audio download failed — continuing without audio: ${message}`);
      }
    }

    const audioProcConfig: AudioProcessorConfig = {
      audioEnabled: config.AUDIO_DETECTION_ENABLED,
      audioProvider: config.AUDIO_PROVIDER,
      chunkLengthSec: config.CHUNK_LENGTH_SEC,
      chunkOverlapSec: config.CHUNK_OVERLAP_SEC,
      outputDir: config.OUTPUT_DIR,
      audioDownloadConfig,
      slicerConfig,
      analyzerChainConfig,
    };

    const audioEvents = await processAudio(
      videoId,
      metadata.duration,
      cache,
      {
        noAudio: args.noAudio,
        gameProfile,
        maxParallel,
        audioPath,
      },
      audioProcConfig,
    );

    const callbacks: import('@lib/types/index.js').StreamCallbacks = {
      onChunkTextDelta: (chunkIndex, text) => {
        process.stdout.write(text);
      },
      onChunkAnalyzed: (chunkIndex, evaluation) => {
        if (evaluation.status === 'success') {
          log.info(
            `  ✓ chunk ${chunkIndex}: interesting=${evaluation.interesting}, score=${evaluation.score}`,
          );
        }
      },
      onSegmentTextDelta: (rank, text) => {
        process.stdout.write(text);
      },
      onSegmentRefined: (rank, segment) => {
        log.info(
          `  ✓ segment rank=${rank}: ${segment.start.toFixed(1)}s–${segment.end.toFixed(1)}s`,
        );
      },
    };

    const { lines, microBlocks, chunkEvals } = await analyzeSegments(
      videoId,
      audioPath,
      audioEvents,
      cache,
      {
        maxChunks: args.maxChunks,
        maxParallel,
        noCache: args.noCache,
        transcriptProvider: config.TRANSCRIPT_PROVIDER,
        transcriptChainConfig,
        microBlockSec: config.MICRO_BLOCK_SEC,
        chunkLengthSec: config.CHUNK_LENGTH_SEC,
        chunkOverlapSec: config.CHUNK_OVERLAP_SEC,
        model,
        maxRetries: config.LLM_MAX_RETRIES,
        systemPrompt: config.LLM_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT,
        llmModel: config.LLM_MODEL,
        callbacks,
      },
    );

    if (config.DUMP_OUTPUTS) {
      await dumpTranscript(videoId, lines);
    }

    const rankedSegments = selectSegments(chunkEvals, audioEvents, {
      threshold,
      topN,
      boostWindow: config.AUDIO_LLM_BOOST_WINDOW,
      scoreBoost: config.AUDIO_LLM_SCORE_BOOST,
      preRoll: config.AUDIO_CLIP_PRE_ROLL,
      postRoll: config.AUDIO_CLIP_POST_ROLL,
    });

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
      maxRetries: config.LLM_MAX_RETRIES,
      model,
      callbacks,
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

    const exporterConfig: ClipExporterConfig = {
      downloader: downloaderConfig,
      clipper: clipperConfig,
      downloadSectionsMode: config.DOWNLOAD_SECTIONS_MODE,
    };

    const clipPaths = await exportClips(
      videoId,
      refinedSegments,
      {
        localVideo: args.localVideo,
        downloadSections: args.downloadSections,
        videoPath: args.videoPath,
        clipConcurrency: config.CLIP_CONCURRENCY,
      },
      exporterConfig,
    );

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

const DEFAULT_SYSTEM_PROMPT = `You are an expert video editor analyzing a YouTube transcript segment.

Identify if this segment contains a potentially interesting moment worth clipping.

Interesting moments include:
- surprising insights or revelations
- strong or controversial opinions
- humor or entertaining storytelling
- emotional moments
- key explanations of important concepts
- "aha" moments or turning points

If audio events are listed in the segment, treat them as strong positive signals —
they indicate high-action or high-energy moments that are often clip-worthy.`;
