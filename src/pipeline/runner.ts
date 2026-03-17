import { promises as fs } from 'fs';
import { config } from '../config/index.js';
import { Cache } from '../utils/cache.js';
import { log } from '../utils/logger.js';
import { dumpAnalysis } from '../utils/dumper.js';
import { resolveVideo } from './stages/videoResolver.js';
import { processTranscript } from './stages/transcriptProcessor.js';
import { processAudio } from './stages/audioProcessor.js';
import { analyzeSegments, refineRankedSegments } from './stages/segmentAnalyzer.js';
import { selectSegments } from './stages/segmentSelector.js';
import { exportClips } from './stages/clipExporter.js';
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
 * Ordering: processAudio completes before analyzeSegments so that audio events
 * can be forwarded into each chunk's LLM prompt. refineRankedSegments runs after
 * ranking since it requires the ranked segment list.
 *
 * Hard errors (invalid URL, transcript failure, all LLM chunks failed) are thrown
 * so the caller can catch, log, and exit(1). Soft failures (audio detection,
 * individual clip failures) are logged as warnings and the pipeline continues.
 */
export async function runPipeline(args: CliArgs): Promise<void> {
  const threshold = args.threshold ?? config.SCORE_THRESHOLD;
  const topN = args.topN ?? config.TOP_N_SEGMENTS;
  const gameProfile = args.gameProfile ?? config.GAME_PROFILE;
  const maxParallel = args.maxParallel ?? config.LLM_CONCURRENCY;

  const cache = new Cache(config.CACHE_DIR, args.noCache);

  // ── Stage 1: Resolve video ID + metadata ─────────────────────────────────
  const { videoId, metadata } = await resolveVideo(args.url as string, args.maxDuration);

  // ── Stage 2: Fetch + chunk transcript ────────────────────────────────────
  const { lines, microBlocks, chunks } = await processTranscript(videoId, cache, {
    dumpOutputs: config.DUMP_OUTPUTS,
  });

  // ── Stage 3: Audio detection ──────────────────────────────────────────────
  const audioEvents = await processAudio(videoId, metadata.duration, cache, {
    noAudio: args.noAudio,
    gameProfile,
  });

  // ── Stage 4a: LLM analysis (informed by audio events) ────────────────────
  const { chunkEvals } = await analyzeSegments(chunks, lines, audioEvents, cache, {
    maxChunks: args.maxChunks,
    maxParallel,
    noCache: args.noCache,
  });

  // ── Stage 5: Merge signals + rank ─────────────────────────────────────────
  const rankedSegments = selectSegments(chunkEvals, audioEvents, { threshold, topN });

  // Build partial result for early-exit path (no segments above threshold)
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

  // ── Stage 4b: Refine clip boundaries (LLM pass 2) ─────────────────────────
  const refinedSegments = await refineRankedSegments(rankedSegments, microBlocks, cache, {
    maxParallel,
    noCache: args.noCache,
  });

  // ── Output result ─────────────────────────────────────────────────────────
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

  // ── Stage 6: Download + generate clips (only with --clip) ─────────────────
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
}
