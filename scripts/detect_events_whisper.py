import json
import sys

# Keyword sets per game profile.
# Keys are lowercase; matches are case-insensitive.
PROFILE_KEYWORDS: dict[str, list[str]] = {
    'valorant': [
        'ace', 'clutch', 'defuse', 'spike', '1v1', '1v2', '1v3', '1v4', '1v5',
        "let's go", 'no way', 'insane', 'bro', 'what', 'oh my god', 'omg',
        'unbelievable', 'crazy', 'yooo', 'yo', 'filthy', 'clean',
        'wallbang', 'headshot',
    ],
    'fps': [
        'kill', 'headshot', 'streak', 'collateral', 'insane', 'no way',
        "let's go", 'yooo', 'yo', 'crazy', 'oh my god', 'omg', 'unbelievable',
        'nice', 'what', 'bro',
    ],
    'boss_fight': [
        'finally', "let's go", 'dead', 'down', 'phase', 'unbelievable', 'insane',
        'crazy', 'no way', 'oh my god', 'omg', 'yooo', 'yo', 'what', 'bro',
    ],
    'general': [
        'insane', 'crazy', 'no way', "let's go", 'oh my god', 'omg',
        'what', 'wow', 'yooo', 'yo', 'unbelievable', 'bro',
    ],
}

# Phrases that get full confidence (exact multi-word match carries more signal).
HIGH_CONFIDENCE_PHRASES: set[str] = {
    'ace', 'clutch', "let's go", 'no way', 'oh my god', 'omg', 'unbelievable',
    '1v1', '1v2', '1v3', '1v4', '1v5', 'finally',
}


def score_text(text: str, keywords: list[str]) -> tuple[str | None, float]:
    """
    Return the first matching keyword and its confidence, or (None, 0).
    Multi-word phrases and high-confidence phrases get confidence 1.0;
    single-word partial matches get 0.8.
    """
    lower = text.lower()
    for kw in keywords:
        if kw in lower:
            conf = 1.0 if kw in HIGH_CONFIDENCE_PHRASES else 0.8
            return kw, conf
    return None, 0.0


def detect_events_whisper(
    audio_path: str,
    model_size: str = 'medium',
    game_profile: str = 'general',
    threshold: float = 0.3,
) -> list[dict]:
    try:
        import whisper  # type: ignore
    except ImportError:
        print(
            json.dumps({'error': 'openai-whisper not installed. Run: pip install openai-whisper'}),
            file=sys.stderr,
        )
        sys.exit(2)

    keywords = PROFILE_KEYWORDS.get(game_profile, PROFILE_KEYWORDS['general'])

    model = whisper.load_model(model_size)
    result = model.transcribe(audio_path, word_timestamps=False, fp16=False)

    events: list[dict] = []
    for seg in result.get('segments', []):
        text: str = seg.get('text', '')
        start: float = float(seg.get('start', 0))
        matched_kw, confidence = score_text(text, keywords)
        if matched_kw is not None and confidence >= threshold:
            events.append({
                'time': round(start, 2),
                'event': matched_kw,
                'confidence': confidence,
            })

    return events


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(
            json.dumps({'error': 'Usage: python detect_events_whisper.py <audio_path> [threshold] [game_profile] [model_size]'}),
        )
        sys.exit(1)

    audio_path = sys.argv[1]
    threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.3
    game_profile = sys.argv[3] if len(sys.argv) > 3 else 'general'
    model_size = sys.argv[4] if len(sys.argv) > 4 else 'medium'

    try:
        result = detect_events_whisper(audio_path, model_size, game_profile, threshold)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
