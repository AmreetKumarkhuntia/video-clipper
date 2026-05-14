import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { ClipEdits } from '@lib/types/clipEdit.js';
import type { ClipperConfig } from '@lib/types/video.js';
import { configureFfmpeg } from '@lib/services/video/clipper/index.js';
import { buildAss } from './subtitleBuilder.js';
import { buildFilterGraph } from './filterGraphBuilder.js';

const RESOLUTIONS: Record<string, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
};

function probeVideo(filePath: string): Promise<{ width: number; height: number; fps: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const videoStream = data.streams.find((s) => s.codec_type === 'video');
      if (!videoStream) return reject(new Error('No video stream found in ' + filePath));

      const width = videoStream.width ?? 1920;
      const height = videoStream.height ?? 1080;

      let fps = 30;
      const avgFr = videoStream.avg_frame_rate;
      if (avgFr && avgFr !== '0/0') {
        const parts = avgFr.split('/');
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1] ?? '1');
        if (den > 0) fps = num / den;
      }

      resolve({ width, height, fps });
    });
  });
}

export async function renderClipWithEdits(
  inputPath: string,
  edits: ClipEdits,
  outputPath: string,
  cfg: ClipperConfig,
): Promise<string> {
  configureFfmpeg(cfg);

  await probeVideo(inputPath);

  const { w: oW, h: oH } = RESOLUTIONS[edits.viewport.preset];

  let assPath: string | null = null;
  if (edits.subtitles.length > 0) {
    const tmpDir = join(cfg.outputDir, 'web', 'clip-edits', 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    assPath = join(tmpDir, `${edits.clipId}.ass`);
    const assContent = buildAss(edits.subtitles, { width: oW, height: oH });
    await fs.writeFile(assPath, assContent, 'utf-8');
  }

  const { filterComplex, mapLabel } = buildFilterGraph(
    edits,
    { width: oW, height: oH, fps: 30 },
    assPath,
  );

  return new Promise<string>((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions(['-ss', String(edits.trim.startSec), '-to', String(edits.trim.endSec)])
      .complexFilter(filterComplex)
      .outputOptions([
        '-map',
        mapLabel,
        '-map',
        '0:a?',
        '-c:v',
        'libx264',
        '-preset',
        cfg.ffmpegPreset,
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err: Error, _stdout: string | null, stderr: string | null) => {
        const msg = stderr ?? err.message;
        if (/No such filter: 'subtitles'|No option name near.*\.ass/i.test(msg)) {
          return reject(
            new Error(
              'ffmpeg is missing libass — the subtitles filter is not available. ' +
                'On macOS the default `ffmpeg` Homebrew formula is minimal — install `ffmpeg-full` (`brew install ffmpeg-full`) and point FFMPEG_PATH / FFPROBE_PATH at `/usr/local/opt/ffmpeg-full/bin/{ffmpeg,ffprobe}`.',
            ),
          );
        }
        if (/No such filter: 'drawtext'/i.test(msg)) {
          return reject(
            new Error(
              'ffmpeg is missing libfreetype — the drawtext filter is not available. ' +
                'Reinstall ffmpeg with libfreetype support (e.g. `brew reinstall ffmpeg`).',
            ),
          );
        }
        reject(err);
      })
      .run();
  });
}
