import { execa } from 'execa';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { log } from '@lib/utils/logger.js';
import type { TranscriptLine } from '@lib/types/transcript.js';
import { TranscriptAnalyzer } from '../../../audio/transcriber/base.js';
import type { YtDlpCookies } from '@lib/types/downloader.js';

interface YouTubeCaptionTrack {
  baseUrl: string;
  kind?: string;
  languageCode: string;
}

interface YouTubePlayerResponse {
  playabilityStatus?: {
    status?: string;
    reason?: string;
    errorScreen?: {
      playerErrorMessageRenderer?: {
        reason?: {
          simpleText?: string;
        };
        subreason?: {
          simpleText?: string;
          runs?: Array<{
            text?: string;
          }>;
        };
      };
    };
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: YouTubeCaptionTrack[];
    };
  };
}

const WATCH_PAGE_URL = 'https://www.youtube.com/watch';
const ACCEPT_LANGUAGE_HEADER = 'en-US,en;q=0.9';
const PLAYER_RESPONSE_MARKERS = ['var ytInitialPlayerResponse = ', 'ytInitialPlayerResponse = '];
const LIVE_CHAT_FILE_RE = /(?:^|[.])live_chat(?:[.-]|$)/i;

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

export function extractInitialPlayerResponse(html: string): YouTubePlayerResponse | null {
  for (const marker of PLAYER_RESPONSE_MARKERS) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) {
      continue;
    }

    const jsonStart = html.indexOf('{', markerIndex + marker.length);
    if (jsonStart === -1) {
      continue;
    }

    const json = extractBalancedJsonObject(html, jsonStart);
    if (!json) {
      continue;
    }

    try {
      return JSON.parse(json) as YouTubePlayerResponse;
    } catch {
      continue;
    }
  }

  return null;
}

export function pickEnglishCaptionTrack(tracks: YouTubeCaptionTrack[]): YouTubeCaptionTrack | null {
  const englishTracks = tracks.filter((track) => isEnglishLanguage(track.languageCode));

  if (englishTracks.length === 0) {
    return null;
  }

  return englishTracks.sort((left, right) => captionTrackScore(right) - captionTrackScore(left))[0];
}

export function rankSubtitleFiles(files: string[]): string[] {
  return files
    .filter((file) => file.endsWith('.vtt') && !LIVE_CHAT_FILE_RE.test(file))
    .sort(
      (left, right) =>
        subtitleFileScore(right) - subtitleFileScore(left) || left.localeCompare(right),
    );
}

function extractBalancedJsonObject(source: string, startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index++) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function isEnglishLanguage(languageCode: string): boolean {
  const normalized = languageCode.trim().toLowerCase();
  return normalized === 'en' || normalized.startsWith('en-');
}

function captionTrackScore(track: YouTubeCaptionTrack): number {
  let score = 0;

  if (track.languageCode.trim().toLowerCase() === 'en') {
    score += 100;
  } else if (isEnglishLanguage(track.languageCode)) {
    score += 90;
  }

  if (track.kind !== 'asr') {
    score += 10;
  }

  return score;
}

function subtitleFileScore(file: string): number {
  let score = 0;

  if (/\.en\.vtt$/i.test(file)) {
    score += 120;
  } else if (/\.en(?:[.-]|$)/i.test(file)) {
    score += 100;
  } else if (/\.en-[A-Z]{2}\.vtt$/i.test(file)) {
    score += 90;
  }

  if (/orig|asr|auto/i.test(file)) {
    score -= 10;
  }

  return score;
}

function playabilityReason(playerResponse: YouTubePlayerResponse): string | null {
  const renderer = playerResponse.playabilityStatus?.errorScreen?.playerErrorMessageRenderer;

  return (
    renderer?.reason?.simpleText ??
    renderer?.subreason?.simpleText ??
    renderer?.subreason?.runs
      ?.map((run) => run.text ?? '')
      .join('')
      .trim() ??
    playerResponse.playabilityStatus?.reason ??
    null
  );
}

function buildCaptionTrackUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('fmt', 'vtt');
  return url.toString();
}

async function fetchTranscriptFromYouTube(videoId: string): Promise<TranscriptLine[] | null> {
  const watchUrl = new URL(WATCH_PAGE_URL);
  watchUrl.searchParams.set('v', videoId);
  watchUrl.searchParams.set('hl', 'en');

  const res = await fetch(watchUrl, {
    headers: {
      'accept-language': ACCEPT_LANGUAGE_HEADER,
    },
  });

  if (!res.ok) {
    throw new Error(`YouTube watch page request failed for "${videoId}": HTTP ${res.status}`);
  }

  const html = await res.text();
  const playerResponse = extractInitialPlayerResponse(html);

  if (!playerResponse) {
    return null;
  }

  if (playerResponse.playabilityStatus?.status === 'LOGIN_REQUIRED') {
    throw new Error(
      `YouTube requires sign-in for "${videoId}": ${playabilityReason(playerResponse) ?? 'Sign in to confirm you are not a bot.'}`,
    );
  }

  const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const track = pickEnglishCaptionTrack(tracks);

  if (!track) {
    return null;
  }

  const captionRes = await fetch(buildCaptionTrackUrl(track.baseUrl), {
    headers: {
      'accept-language': ACCEPT_LANGUAGE_HEADER,
    },
  });

  if (!captionRes.ok) {
    throw new Error(
      `YouTube caption track request failed for "${videoId}": HTTP ${captionRes.status}`,
    );
  }

  const content = await captionRes.text();
  const lines = parseVtt(content);

  return lines.length > 0 ? lines : null;
}

async function readBestSubtitleFile(
  videoId: string,
  tmpDir: string,
): Promise<{ file: string; lines: TranscriptLine[] }> {
  const files = rankSubtitleFiles(await fs.readdir(tmpDir));

  if (files.length === 0) {
    throw new Error(
      `No subtitles found for "${videoId}". The video may not have English captions, or YouTube may require authentication for subtitle access.`,
    );
  }

  for (const file of files) {
    const content = await fs.readFile(path.join(tmpDir, file), 'utf8');
    const lines = parseVtt(content);

    if (lines.length > 0) {
      return { file, lines };
    }
  }

  throw new Error(`Subtitle files for "${videoId}" were empty or contained no parseable cues.`);
}

async function fetchTranscriptViaYtDlp(
  videoId: string,
  cookies: YtDlpCookies,
  directFetchError: Error | null,
): Promise<TranscriptLine[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vc-vtt-'));

  try {
    const args = [
      '--write-subs',
      '--write-auto-subs',
      '--sub-format',
      'vtt',
      '--sub-langs',
      'en.*,-live_chat',
      // mhtml is the format YouTube exposes when the TV-client n-challenge JS
      // solver fails (Deno bug). Selecting it explicitly keeps yt-dlp from
      // bailing out with "Requested format is not available" before it writes
      // the VTT subtitle files. The format is irrelevant because --skip-download
      // means no video/audio is actually downloaded.
      '--format',
      'mhtml',
      '--skip-download',
      '--no-playlist',
      '--output',
      path.join(tmpDir, '%(id)s.%(ext)s'),
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    if (cookies.cookiesFromBrowser) {
      args.unshift('--cookies-from-browser', cookies.cookiesFromBrowser);
    } else if (cookies.cookiesFile) {
      args.unshift('--cookies', cookies.cookiesFile);
    }

    try {
      await execa('yt-dlp', args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (
        message.includes('Sign in to confirm') ||
        message.includes('confirm you’re not a bot') ||
        message.includes("confirm you're not a bot") ||
        directFetchError?.message.includes('YouTube requires sign-in')
      ) {
        if (cookies.cookiesFromBrowser || cookies.cookiesFile) {
          throw new Error(
            `YouTube rejected the current cookies while fetching subtitles for "${videoId}". Refresh the cookies from a fresh private/incognito YouTube session and retry.`,
          );
        }

        throw new Error(
          `YouTube requires authentication to access subtitles for "${videoId}". Set YT_DLP_COOKIES_FROM_BROWSER=chrome (or firefox/safari) or YT_DLP_COOKIES_FILE to a fresh cookies.txt export and retry.`,
        );
      }

      throw new Error(`yt-dlp failed to fetch subtitles for "${videoId}": ${message}`);
    }

    const { file, lines } = await readBestSubtitleFile(videoId, tmpDir);

    log.info(`Parsed ${lines.length} cues from subtitle file "${file}".`);
    return lines;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Fetches the transcript for a given YouTube video ID.
 *
 * Strategy:
 * 1. Read public caption-track metadata directly from the YouTube watch page.
 * 2. Fetch the English track from YouTube's own timedtext endpoint when available.
 * 3. Fall back to yt-dlp subtitle extraction when YouTube does not expose public tracks.
 *
 * Cookie config (YT_DLP_COOKIES_FROM_BROWSER / YT_DLP_COOKIES_FILE) is only
 * used for the yt-dlp fallback path.
 */
async function fetchTranscript(videoId: string, cookies: YtDlpCookies): Promise<TranscriptLine[]> {
  let directFetchError: Error | null = null;

  try {
    const directLines = await fetchTranscriptFromYouTube(videoId);

    if (directLines) {
      log.info(`Fetched ${directLines.length} cues directly from YouTube for "${videoId}".`);
      return directLines;
    }
  } catch (err) {
    directFetchError = err instanceof Error ? err : new Error(String(err));
    log.warn(
      `[transcript:youtube] direct caption fetch failed for "${videoId}", falling back to yt-dlp: ${directFetchError.message}`,
    );
  }

  return fetchTranscriptViaYtDlp(videoId, cookies, directFetchError);
}

/**
 * Fetches the YouTube transcript from YouTube caption tracks first, then
 * falls back to yt-dlp subtitle extraction when needed.
 *
 * This is the default transcript provider. It does not use the audio file —
 * the `audioPath` parameter is accepted but ignored.
 */
export class YtDlpTranscriptAnalyzer extends TranscriptAnalyzer {
  readonly source = 'ytdlp' as const;

  constructor(private readonly cookies: YtDlpCookies = {}) {
    super();
  }

  async detect(videoId: string, _audioPath: string | null): Promise<TranscriptLine[]> {
    return fetchTranscript(videoId, this.cookies);
  }
}
