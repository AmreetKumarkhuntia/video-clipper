import { execa } from 'execa';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config/index.js';

export async function downloadAudio(videoId: string, outputDir: string): Promise<string> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${videoId}_audio.wav`);

  if (fs.existsSync(outputPath)) {
    console.log(`[audio] Cache hit: ${outputPath}`);
    return outputPath;
  }

  console.log(`[audio] Downloading audio for ${videoId}...`);

  await execa('yt-dlp', [
    '-x',
    '--audio-format',
    'wav',
    '--audio-quality',
    '0',
    '--postprocessor-args',
    '-ar 16000 -ac 1',
    '-o',
    outputPath,
    `https://youtube.com/watch?v=${videoId}`,
  ]);

  console.log(`[audio] Audio saved to ${outputPath}`);
  return outputPath;
}
