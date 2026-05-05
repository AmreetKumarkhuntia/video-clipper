import { execa } from 'execa';
import type { AudioEvent } from '@lib/types/audio.js';
import { AudioAnalyzer } from './base.js';
import { getPythonBin } from '@lib/utils/pythonBin.js';
import { scriptPath } from '@lib/utils/paths.js';

export class YAMNetAudioAnalyzer extends AudioAnalyzer {
  readonly source = 'yamnet' as const;

  constructor(private readonly confidenceThreshold: number) {
    super();
  }

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
        scriptPath('detect_events.py'),
        audioPath,
        String(this.confidenceThreshold),
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
