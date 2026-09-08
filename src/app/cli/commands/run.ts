import { promises as fs } from 'fs';
import { log } from '@lib/utils/logger.js';
import { formatSeconds } from '@lib/utils/format.js';
import { tryParseVideoId } from '@lib/utils/youtubeUrl.js';
import { apiBaseUrl, apiGet, apiSend } from '../client/index.js';
import { streamAnalysis } from '../client/analysisStream.js';
import { backendSettings, describeSetting, numberSetting } from '../client/settings.js';
import { parseArgs, printUsage } from '../args.js';
import { printAnalysisSummary, printClipResults } from '../output/formatter.js';
import { createAnalysisCallbacks } from '../output/progress.js';
import type {
  ClipArtifact,
  CreateAnalysisRequest,
  CreateClipsRequest,
} from '@lib/types/analysis.js';
import type { CommandHandler } from '@lib/types/command.js';
import type { VideoDetails } from '@lib/types/youtube.js';

async function run(argv: string[], requestId: string): Promise<void> {
  const args = parseArgs(['_', '_', ...argv]);

  if (args.help) {
    printUsage(await backendSettings());
    return;
  }

  if (!args.url) {
    log.error('run', 'No YouTube URL provided.', requestId);
    printUsage();
    process.exit(1);
  }

  if (args.noAudio || args.gameProfile) {
    log.warn(
      'run',
      'The --no-audio and --game-profile flags are deprecated and ignored: the run command no longer performs audio event detection.',
      requestId,
    );
  }

  const videoId = tryParseVideoId(args.url);
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${args.url}`);
  }

  // One read of the backend's settings serves the whole run: the model name in
  // the banner, and the chunk count the progress bar sizes itself from.
  const values = await backendSettings();

  log.info(
    'run',
    `Starting video-clipper against ${apiBaseUrl()} (model: ${describeSetting(values, 'LLM_MODEL')})` +
      (args.clip ? ' [--clip enabled]' : '') +
      (args.localVideo ? ` [--local-video: ${args.localVideo}]` : ''),
    requestId,
  );

  log.info('run', `Fetching metadata for ${videoId}...`, requestId);

  // Metadata comes from the backend rather than a local yt-dlp probe. That is
  // what replaces the command's own upsertVideo: the read write-throughs the
  // channel and video catalog rows, in the process that owns the database.
  const video = await apiGet<VideoDetails>(`/api/youtube/videos/${encodeURIComponent(videoId)}`);
  log.info(
    'run',
    `Video: "${video.title}" (${video.durationSec > 0 ? formatSeconds(video.durationSec) : 'duration unknown'})`,
    requestId,
  );

  if (args.maxDuration && video.durationSec > 0 && video.durationSec > args.maxDuration) {
    throw new Error(
      `Video duration exceeds --max-duration limit. ` +
        `(${formatSeconds(video.durationSec)} > ${formatSeconds(args.maxDuration)})`,
    );
  }

  const analysisInput: CreateAnalysisRequest = {
    videoId,
    title: video.title,
    durationSec: video.durationSec,
    options: {
      maxChunks: args.maxChunks,
      maxParallel: args.maxParallel,
      noCache: args.noCache,
      noSegmentCache: false,
      threshold: args.threshold,
      topN: args.topN,
      refine: true,
    },
  };

  // Ctrl-C stops reading the stream and leaves. Dropping the connection is what
  // cancels the run: the route hands the request's signal to the orchestrator,
  // so the LLM work stops server-side too.
  let aborted = false;
  process.on('SIGINT', () => {
    aborted = true;
    log.warn('run', 'Received SIGINT — aborting...', requestId);
  });

  const chunkCount = args.maxChunks ?? numberSetting(values, 'MAX_CHUNKS') ?? 0;
  const callbacks = createAnalysisCallbacks(chunkCount, requestId);

  log.info('run', 'Starting analysis...', requestId);
  const plan = await streamAnalysis(analysisInput, callbacks, () => aborted);

  if (aborted) {
    process.exit(130);
  }

  if (!plan) {
    throw new Error('The backend closed the analysis stream before sending a plan.');
  }

  printAnalysisSummary(plan);

  // Written from this machine, unlike everything else here: --output-json names
  // a path on the caller's disk, which the backend cannot reach.
  if (args.outputJson) {
    await fs.writeFile(args.outputJson, JSON.stringify(plan, null, 2) + '\n', 'utf-8');
    log.info('run', `Wrote analysis JSON to ${args.outputJson}`, requestId);
  }

  if (!args.clip) return;

  if (plan.candidates.length === 0) {
    log.warn('run', 'No clip candidates found — skipping clip generation.', requestId);
    return;
  }

  const clipInput: CreateClipsRequest = {
    videoId: plan.videoId,
    analysisId: plan.id,
    segments: plan.candidates.map((c) => ({
      id: c.id,
      rank: c.rank,
      startSec: c.startSec,
      endSec: c.endSec,
      score: c.score,
      reason: c.reason,
      source: c.source,
      audioEvent: c.audioEvent,
    })),
    options: {
      localVideo: args.localVideo,
      videoPath: args.videoPath,
      downloadSections: args.downloadSections,
    },
  };

  log.info('run', `Generating ${plan.candidates.length} clips...`, requestId);
  const { clips } = await apiSend<{ clips: ClipArtifact[] }>('/api/clips', 'POST', clipInput);
  printClipResults(clips);
}

export const runCommand: CommandHandler = {
  name: 'run',
  description: 'One-shot pipeline: analyze + clip in one command',
  usage: 'video-clipper run <youtube-url> [options]',
  run,
};
