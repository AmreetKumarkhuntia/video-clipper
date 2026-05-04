import { execa } from 'execa';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '@lib/utils/logger.js';
import type { YtDlpCookies } from '../../video/source/youtube/metadata.js';

export interface AudioDownloadConfig extends YtDlpCookies {
  ffmpegPath?: string;
}

export async function downloadAudio(
  videoId: string,
  outputDir: string,
  audioConfig: AudioDownloadConfig = {},
): Promise<string> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${videoId}_audio.wav`);

  if (fs.existsSync(outputPath)) {
    console.log(`[audio] Using cached audio: ${outputPath}`);
    return outputPath;
  }

  console.log(`[audio] Downloading audio for ${videoId}...`);

  try {
    const args = [
      '-x',
      '--audio-format',
      'wav',
      '--audio-quality',
      '0',
      '--postprocessor-args',
      'ffmpeg:-ar 16000 -ac 1',
      '-o',
      outputPath,
      '--newline',
      `https://youtube.com/watch?v=${videoId}`,
    ];

    if (audioConfig.ffmpegPath) {
      args.unshift('--ffmpeg-location', audioConfig.ffmpegPath);
    }

    if (audioConfig.cookiesFromBrowser) {
      args.unshift('--cookies-from-browser', audioConfig.cookiesFromBrowser);
    } else if (audioConfig.cookiesFile) {
      args.unshift('--cookies', audioConfig.cookiesFile);
    }

    const subprocess = execa('yt-dlp', args);

    subprocess.stdout?.on('data', log.progress);
    subprocess.stderr?.on('data', log.progress);

    await subprocess;
    process.stdout.write('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('command not found') || message.includes('ENOENT')) {
      throw new Error('yt-dlp is required. Install it: https://github.com/yt-dlp/yt-dlp');
    }

    if (message.includes('ffprobe and ffmpeg not found') || message.includes('ffmpeg not found')) {
      throw new Error(
        'ffmpeg is required for audio processing. Install it: `brew install ffmpeg`' +
          (audioConfig.ffmpegPath
            ? ''
            : '\nOr set FFMPEG_PATH in your .env to your ffmpeg binary location.'),
      );
    }

    if (message.includes('Private video')) {
      throw new Error(`Video "${videoId}" is private and cannot be downloaded.`);
    }

    if (message.includes('Sign in to confirm') || message.includes('confirm you')) {
      throw new Error(
        `yt-dlp was blocked by YouTube bot detection for "${videoId}". ` +
          `Set YT_DLP_COOKIES_FROM_BROWSER=chrome (or firefox/safari) in your .env to authenticate.`,
      );
    }

    if (message.includes('not available in your country') || message.includes('geo')) {
      throw new Error(`Video "${videoId}" is geo-blocked in your region.`);
    }

    throw new Error(`Audio download failed: ${message}`);
  }

  console.log(`[audio] Audio saved to ${outputPath}`);
  return outputPath;
}
