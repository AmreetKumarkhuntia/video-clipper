import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import type { SlicerConfig } from '@lib/types/audio.js';

export type { SlicerConfig } from '@lib/types/audio.js';

export async function sliceAudio(
  inputPath: string,
  startSec: number,
  durationSec: number,
  outputDir: string,
  slicerConfig: SlicerConfig = {},
): Promise<string> {
  if (slicerConfig.ffmpegPath) {
    ffmpeg.setFfmpegPath(slicerConfig.ffmpegPath);
  }
  if (slicerConfig.ffprobePath) {
    ffmpeg.setFfprobePath(slicerConfig.ffprobePath);
  }
  const filename = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputDir, `${filename}_slice_${startSec}.wav`);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSec)
      .setDuration(durationSec)
      .audioFrequency(16000)
      .audioChannels(1)
      .format('wav')
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });

  return outputPath;
}
