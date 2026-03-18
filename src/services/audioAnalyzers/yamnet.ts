import { execa } from 'execa';
import { config } from '../../config/index.js';
import type { AudioEvent } from '../../types/index.js';
import { AudioAnalyzer } from './base.js';
import { getPythonBin } from './whisper.js';

/**
 * Uses YAMNet (TensorFlow Hub) via a Python script to classify audio frames
 * against a fixed set of game-relevant sound classes (gunshot, explosion, etc.).
 *
 * Requires: pip install tensorflow-hub soundfile numpy
 */
export class YAMNetAudioAnalyzer extends AudioAnalyzer {
  readonly source = 'yamnet' as const;

  async detect(
    audioPath: string,
    _gameProfile: string,
    chunkOffsetSec: number,
    _chunkDurationSec: number,
  ): Promise<AudioEvent[]> {
    const python = await getPythonBin();

    let stdout: string;
    try {
      const result = await execa(python, [
        'scripts/detect_events.py',
        audioPath,
        String(config.AUDIO_CONFIDENCE_THRESHOLD),
      ]);
      stdout = result.stdout;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('ModuleNotFoundError') || message.includes('No module named')) {
        throw new Error(
          'YAMNet dependencies missing. Run: pip3 install tensorflow-hub soundfile numpy\n' +
            'Or set AUDIO_PROVIDER=gemini in .env and configure GOOGLE_GENERATIVE_AI_API_KEY.',
        );
      }

      throw new Error(`YAMNet detection failed: ${message}`);
    }

    const events = JSON.parse(stdout) as Array<{ time: number; event: string; confidence: number }>;

    return events.map((e) => ({
      time: e.time + chunkOffsetSec,
      event: e.event,
      confidence: e.confidence,
      source: this.source,
    }));
  }
}
