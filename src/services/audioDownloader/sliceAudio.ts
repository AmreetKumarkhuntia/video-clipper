import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { config } from '../../config/index.js';

if (config.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(config.FFMPEG_PATH);
}
if (config.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(config.FFPROBE_PATH);
}

export async function sliceAudio(
  inputPath: string,
  startSec: number,
  durationSec: number,
  outputDir: string,
): Promise<string> {
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
