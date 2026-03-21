import { execa } from 'execa';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { log } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import type { TranscriptLine } from '../../types/index.js';
import { TranscriptAnalyzer } from './base.js';

/**
 * Parses a WebVTT string into TranscriptLine[].
 *
 * Handles:
 * - `HH:MM:SS.mmm --> HH:MM:SS.mmm` timestamp lines
 * - `<MM:SS.mmm><c>text</c>` inline cue tags (stripped)
 * - Duplicate / empty cues (skipped)
 *
 * Exported for unit testing.
 */
export function parseVtt(vttContent: string): TranscriptLine[] {
  const lines = vttContent.split(/\r?\n/);
  const result: TranscriptLine[] = [];

  /** Regex to match HH:MM:SS.mmm --> HH:MM:SS.mmm timestamp lines */
  const TIMESTAMP_RE =
    /^(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const match = TIMESTAMP_RE.exec(line);

    if (match) {
      const startSec =
        parseInt(match[1], 10) * 3600 +
        parseInt(match[2], 10) * 60 +
        parseInt(match[3], 10) +
        parseInt(match[4], 10) / 1000;

      const endSec =
        parseInt(match[5], 10) * 3600 +
        parseInt(match[6], 10) * 60 +
        parseInt(match[7], 10) +
        parseInt(match[8], 10) / 1000;

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }

      const rawText = textLines.join(' ');

      const text = rawText
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length === 0) {
        continue;
      }

      const duration = Math.max(0, endSec - startSec);

      /** Skip duplicate cues - YouTube VTT often repeats same line as text scrolls */
      if (result.length > 0 && result[result.length - 1].text === text) {
        continue;
      }

      result.push({ text, start: startSec, duration });
      continue;
    }

    i++;
  }

  return result;
}

/**
 * Fetches the transcript for a given YouTube video ID using yt-dlp
 * auto-generated subtitles (VTT format).
 *
 * The VTT file is written to a temp directory, parsed into TranscriptLine[],
 * then cleaned up. Cookie config (YT_DLP_COOKIES_FROM_BROWSER /
 * YT_DLP_COOKIES_FILE) is forwarded to yt-dlp automatically.
 *
 * @throws {Error} with the yt-dlp stderr if the command fails
 * @throws {Error} if no subtitle file is produced
 * @throws {Error} if the subtitle file contains no parseable cues
 */
async function fetchTranscript(videoId: string): Promise<TranscriptLine[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vc-vtt-'));

  try {
    const args = [
      '--write-auto-sub',
      '--sub-format',
      'vtt',
      '--sub-lang',
      'en.*',
      '--skip-download',
      '--output',
      path.join(tmpDir, '%(id)s.%(ext)s'),
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    if (config.YT_DLP_COOKIES_FROM_BROWSER) {
      args.unshift('--cookies-from-browser', config.YT_DLP_COOKIES_FROM_BROWSER);
    } else if (config.YT_DLP_COOKIES_FILE) {
      args.unshift('--cookies', config.YT_DLP_COOKIES_FILE);
    }

    try {
      await execa('yt-dlp', args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`yt-dlp failed to fetch subtitles for "${videoId}": ${message}`);
    }

    const files = await fs.readdir(tmpDir);
    const vttFile = files.find((f) => f.endsWith('.vtt'));

    if (!vttFile) {
      throw new Error(
        `No subtitles found for "${videoId}". The video may not have auto-generated captions.`,
      );
    }

    const content = await fs.readFile(path.join(tmpDir, vttFile), 'utf8');
    const lines = parseVtt(content);

    log.info(`Parsed ${lines.length} cues from subtitle file "${vttFile}".`);

    if (lines.length === 0) {
      throw new Error(`Subtitle file for "${videoId}" was empty or contained no parseable cues.`);
    }

    return lines;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Fetches the YouTube transcript via yt-dlp auto-generated subtitles (VTT).
 *
 * This is the default transcript provider. It does not use the audio file —
 * the `audioPath` parameter is accepted but ignored.
 *
 * Requires: yt-dlp installed and available on PATH.
 */
export class YtDlpTranscriptAnalyzer extends TranscriptAnalyzer {
  readonly source = 'ytdlp' as const;

  async detect(videoId: string, _audioPath: string | null): Promise<TranscriptLine[]> {
    return fetchTranscript(videoId);
  }
}
