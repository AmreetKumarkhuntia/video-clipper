import { TranscriptDetector } from '@lib/services/analysis/transcript/detector.js';
import { createTranscriptChain } from '@lib/services/audio/transcriber/index.js';
import type { TranscriptChainConfig } from '@lib/services/audio/transcriber/index.js';
import type { YtDlpCookies } from '@lib/services/video/source/youtube/metadata.js';
import {
  buildMicroBlocks,
  buildLLMChunks,
} from '@lib/services/analysis/transcript/chunker/index.js';
import {
  findTranscriptLines,
  saveTranscript,
  clearTranscript,
} from '@lib/services/db/repos/videosRepo.js';
import { upsertChunks, deleteChunks } from '@lib/services/db/repos/chunksRepo.js';
import { TranscriptBundleSchema } from '@lib/types/analysis.js';
import type { TranscriptBundle } from '@lib/types/analysis.js';
import type { Config } from '@lib/types/config.js';

async function getTranscriptBundle(videoId: string, cfg: Config): Promise<TranscriptBundle> {
  const cookies: YtDlpCookies = {
    cookiesFromBrowser: cfg.YT_DLP_COOKIES_FROM_BROWSER,
    cookiesFile: cfg.YT_DLP_COOKIES_FILE,
    quiet: cfg.YT_DLP_QUIET,
    retryCount: cfg.YT_DLP_RETRY_COUNT,
  };

  const transcriptChainConfig: TranscriptChainConfig = {
    ...cookies,
    whisperModel: cfg.AUDIO_WHISPER_MODEL,
  };

  const detector = new TranscriptDetector(
    createTranscriptChain(cfg.TRANSCRIPT_PROVIDER, transcriptChainConfig),
    cfg.MICRO_BLOCK_SEC,
    cfg.CHUNK_LENGTH_SEC,
    cfg.CHUNK_OVERLAP_SEC,
  );
  const { lines, microBlocks, chunks } = await detector.detect(videoId, null);

  return TranscriptBundleSchema.parse({
    videoId,
    lines,
    microBlocks,
    chunks,
    fetchedAt: new Date().toISOString(),
  });
}

export async function loadOrFetchTranscript(
  videoId: string,
  cfg: Config,
): Promise<TranscriptBundle> {
  const stored = findTranscriptLines(videoId);
  if (stored) {
    const microBlocks = buildMicroBlocks(stored.lines, cfg.MICRO_BLOCK_SEC);
    const chunks = buildLLMChunks(microBlocks, cfg.CHUNK_LENGTH_SEC, cfg.CHUNK_OVERLAP_SEC);
    return TranscriptBundleSchema.parse({
      videoId,
      lines: stored.lines,
      microBlocks,
      chunks,
      fetchedAt: stored.fetchedAt,
    });
  }

  const transcript = await getTranscriptBundle(videoId, cfg);
  saveTranscript(videoId, transcript.lines, transcript.fetchedAt);
  const microBlocks = buildMicroBlocks(transcript.lines, cfg.MICRO_BLOCK_SEC);
  const chunks = buildLLMChunks(microBlocks, cfg.CHUNK_LENGTH_SEC, cfg.CHUNK_OVERLAP_SEC);
  upsertChunks(
    videoId,
    chunks.map((c) => ({ videoId, chunk: JSON.stringify(c), start: c.start, end: c.end })),
  );
  return TranscriptBundleSchema.parse({
    videoId,
    lines: transcript.lines,
    microBlocks,
    chunks,
    fetchedAt: transcript.fetchedAt,
  });
}

export function clearVideoTranscript(videoId: string): { dbCleared: boolean } {
  const dbCleared = clearTranscript(videoId);
  deleteChunks(videoId);
  return { dbCleared };
}
