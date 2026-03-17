import { execa } from 'execa';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config/index.js';

function displayProgress(stream: 'stdout' | 'stderr'): (data: Buffer | string) => void {
  return (data: Buffer | string) => {
    const text = String(data);
    const lines = text.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*%)/);
      if (progressMatch) {
        process.stdout.write(`\r${progressMatch[0]}`);
      }
    }
  };
}

export async function downloadAudio(videoId: string, outputDir: string): Promise<string> {
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

    if (config.FFMPEG_PATH) {
      args.unshift('--ffmpeg-location', config.FFMPEG_PATH);
    }

    const subprocess = execa('yt-dlp', args);

    subprocess.stdout?.on('data', displayProgress('stdout'));
    subprocess.stderr?.on('data', displayProgress('stderr'));

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
          (config.FFMPEG_PATH
            ? ''
            : '\nOr set FFMPEG_PATH in your .env to your ffmpeg binary location.'),
      );
    }

    if (message.includes('Private video') || message.includes('Sign in')) {
      throw new Error(`Video "${videoId}" is private and cannot be downloaded.`);
    }

    if (message.includes('not available in your country') || message.includes('geo')) {
      throw new Error(`Video "${videoId}" is geo-blocked in your region.`);
    }

    throw new Error(`Audio download failed: ${message}`);
  }

  console.log(`[audio] Audio saved to ${outputPath}`);
  return outputPath;
}
