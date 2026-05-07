import { execa } from 'execa';
import type { TranscriptLine } from '@lib/types/transcript.js';
import { TranscriptAnalyzer } from './base.js';
import { getPythonBin } from '@lib/utils/pythonBin.js';
import { scriptPath } from '@lib/utils/paths.js';
import { WhisperSegmentSchema } from '@lib/types/audio.js';

/**
 * Generates a transcript by running OpenAI Whisper locally on the downloaded
 * audio file, then normalising the output to TranscriptLine[].
 *
 * Requires:
 *   - audioPath must not be null (audio must be downloaded before calling detect)
 *   - pip install openai-whisper
 *
 * The underlying script is `scripts/transcribe_whisper.py` which writes a JSON
 * array of `{text, start, duration}` objects to stdout.
 */
export class WhisperTranscriptAnalyzer extends TranscriptAnalyzer {
  readonly source = 'whisper' as const;

  constructor(private readonly whisperModel: string) {
    super();
  }

  async detect(videoId: string, audioPath: string | null): Promise<TranscriptLine[]> {
    if (!audioPath) {
      throw new Error(
        'WhisperTranscriptAnalyzer requires an audio file. ' +
          'Ensure downloadAudio() runs before processTranscript() in the pipeline.',
      );
    }

    const python = await getPythonBin();

    let stdout: string;
    try {
      const result = await execa(python, [
        scriptPath('transcribe_whisper.py'),
        audioPath,
        this.whisperModel,
      ]);
      stdout = result.stdout;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('ModuleNotFoundError') || message.includes('No module named')) {
        throw new Error(
          'openai-whisper not installed. Run: pip install openai-whisper\n' +
            'Or set TRANSCRIPT_PROVIDER=ytdlp in .env to use yt-dlp subtitles instead.',
        );
      }

      throw new Error(`Whisper transcription failed for "${videoId}": ${message}`);
    }

    const raw = JSON.parse(stdout) as unknown[];
    const segments = raw.map((seg) => WhisperSegmentSchema.parse(seg));

    return segments.map((seg) => ({
      text: seg.text.trim(),
      start: seg.start,
      duration: seg.duration,
    }));
  }
}
