"""
transcribe_whisper.py — Full Whisper transcription for transcript generation.

Runs OpenAI Whisper on the provided audio file and writes a JSON array of
transcript segments to stdout:

    [{"text": "...", "start": 0.0, "duration": 3.5}, ...]

Usage:
    python transcribe_whisper.py <audio_path> [model_size]

Arguments:
    audio_path  - Path to the audio WAV file
    model_size  - Whisper model to use (default: medium)
                  Options: tiny, base, small, medium, large-v3

Requires: pip install openai-whisper
"""

import json
import sys


def transcribe(audio_path: str, model_size: str = 'medium') -> list[dict]:
    try:
        import whisper  # type: ignore
    except ImportError:
        print(
            'ModuleNotFoundError: openai-whisper not installed. Run: pip install openai-whisper',
            file=sys.stderr,
        )
        sys.exit(2)

    model = whisper.load_model(model_size)
    result = model.transcribe(audio_path, word_timestamps=False, fp16=False)

    segments: list[dict] = []
    for seg in result.get('segments', []):
        text: str = seg.get('text', '').strip()
        start: float = float(seg.get('start', 0))
        end: float = float(seg.get('end', start))
        duration = max(0.0, round(end - start, 3))

        if text:
            segments.append({
                'text': text,
                'start': round(start, 3),
                'duration': duration,
            })

    return segments


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(
            'Usage: python transcribe_whisper.py <audio_path> [model_size]',
            file=sys.stderr,
        )
        sys.exit(1)

    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else 'medium'

    try:
        output = transcribe(audio_path, model_size)
        print(json.dumps(output))
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)
