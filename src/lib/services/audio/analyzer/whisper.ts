import { execa } from 'execa';
import type { AudioEvent } from '@lib/types/audio.js';
import { AudioAnalyzer } from './base.js';
import { getPythonBin } from '@lib/utils/pythonBin.js';
import { scriptPath } from '@lib/utils/paths.js';

export class WhisperAudioAnalyzer extends AudioAnalyzer {
  readonly source = 'whisper' as const;

  constructor(
    private readonly confidenceThreshold: number,
    private readonly whisperModel: string,
  ) {
    super();
  }

  async detect(
    audioPath: string,
    gameProfile: string,
    chunkOffsetSec: number,
    _chunkDurationSec: number,
  ): Promise<AudioEvent[]> {
    const python = await getPythonBin();

    let stdout: string;
    try {
      const result = await execa(python, [
        scriptPath('detect_events_whisper.py'),
        audioPath,
        String(this.confidenceThreshold),
        gameProfile,
        this.whisperModel,
      ]);
      stdout = result.stdout;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('ModuleNotFoundError') || message.includes('No module named')) {
        throw new Error(
          'openai-whisper not installed. Run: pip install openai-whisper\n' +
            'Or set AUDIO_PROVIDER=gemini in .env and configure GOOGLE_GENERATIVE_AI_API_KEY.',
        );
      }

      throw new Error(`Whisper detection failed: ${message}`);
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
