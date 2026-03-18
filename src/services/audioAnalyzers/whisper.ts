import { execa } from 'execa';
import { config } from '../../config/index.js';
import { log } from '../../utils/logger.js';
import type { AudioEvent } from '../../types/index.js';
import { AudioAnalyzer } from './base.js';

/**
 * Resolves the Python interpreter binary, caching the result after the first
 * successful lookup. Shared by both Python-based analyzers (Whisper, YAMNet).
 */
let _pythonBin: string | null = null;

export async function getPythonBin(): Promise<string> {
  if (_pythonBin) return _pythonBin;

  for (const bin of ['python3', 'python']) {
    try {
      await execa(bin, ['--version']);
      _pythonBin = bin;
      return bin;
    } catch {
      log.warn(`[audio] ${bin} not found, trying next binary...`);
    }
  }

  throw new Error(
    'No Python interpreter found (tried python3, python). Install Python 3 to use YAMNet or Whisper.',
  );
}

/**
 * Uses OpenAI Whisper (local) to transcribe the audio chunk and scan the
 * resulting transcript for hype keywords per game profile.
 *
 * Requires: pip install openai-whisper
 */
export class WhisperAudioAnalyzer extends AudioAnalyzer {
  readonly source = 'whisper' as const;

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
        'scripts/detect_events_whisper.py',
        audioPath,
        String(config.AUDIO_CONFIDENCE_THRESHOLD),
        gameProfile,
        config.AUDIO_WHISPER_MODEL,
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
