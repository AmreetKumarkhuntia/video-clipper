// youtube-transcript's package.json has "type":"module" but no "exports" field,
// so Node resolves the CJS bundle via "main" and fails. Import the ESM build directly.
// The types live at the package root, so we declare the subpath module here.
import { YoutubeTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';
import type { TranscriptResponse } from 'youtube-transcript';
import { log } from '../../utils/logger.js';
import type { TranscriptLine } from '../../types/index.js';

/**
 * Fetches the transcript for a given YouTube video ID and normalizes
 * timestamps from milliseconds to seconds.
 *
 * @throws {Error} if no transcript lines are returned (captions unavailable)
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptLine[]> {
  let raw: TranscriptResponse[];

  try {
    raw = await YoutubeTranscript.fetchTranscript(videoId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch transcript for video "${videoId}": ${message}`);
  }

  if (!raw || raw.length === 0) {
    throw new Error(
      `No transcript found for video "${videoId}". Check that captions are enabled.`
    );
  }

  // Detect auto-generated captions heuristically: youtube-transcript doesn't
  // expose a direct flag, but videos with very short, uniform duration blocks
  // are typically ASR-generated. Warn but do not abort.
  const avgDuration = raw.reduce((sum: number, l: TranscriptResponse) => sum + (l.duration ?? 0), 0) / raw.length;
  if (avgDuration > 0 && avgDuration < 1500) {
    log.warn(
      `Transcript for "${videoId}" may be auto-generated (avg block duration ${Math.round(avgDuration)}ms). Accuracy may be lower.`
    );
  }

  // Normalize: offset (ms) → start (s), duration (ms) → duration (s)
  const lines: TranscriptLine[] = raw.map((line: TranscriptResponse) => ({
    text: line.text,
    start: line.offset / 1000,
    duration: line.duration / 1000,
  }));

  return lines;
}
