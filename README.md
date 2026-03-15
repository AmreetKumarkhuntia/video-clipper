# video-clipper

A system that takes a YouTube URL, analyzes the transcript using an LLM, and identifies the most interesting/high-value moments — returning timestamp ranges and optionally cutting clips automatically.

## What it does

1. Takes a YouTube URL
2. Extracts the transcript with timestamps
3. Uses an LLM to analyze the transcript in parallel chunks
4. Identifies interesting moments (insights, humor, storytelling, controversy, etc.)
5. Returns ranked timestamp ranges
6. Optionally downloads the video and cuts clips using ffmpeg

## Tech Stack

- **Backend:** Python / FastAPI
- **Transcript:** `youtube-transcript-api`
- **Video download:** `yt-dlp`
- **Clip cutting:** `ffmpeg`
- **LLM:** OpenAI / Anthropic / Google (configurable)
- **Async:** Python `asyncio` for parallel LLM calls

## Setup

```bash
pip install fastapi youtube-transcript-api yt-dlp openai
```

Set your LLM API key:

```bash
export OPENAI_API_KEY=your_key_here
```

ffmpeg must be installed separately:

```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg
```

## Configuration

Key parameters (all configurable):

| Parameter | Default | Description |
|---|---|---|
| `SCORE_THRESHOLD` | 7 | Minimum LLM score to keep a segment |
| `TOP_N_SEGMENTS` | 10 | Max segments to return |
| `CHUNK_LENGTH_SEC` | 120 | LLM analysis chunk size (seconds) |
| `CHUNK_OVERLAP_SEC` | 20 | Overlap between chunks |
| `LLM_MODEL` | `gpt-4o` | Model to use |

## Output

```json
{
  "video_id": "abc123",
  "title": "Video Title",
  "duration": 1823,
  "segments": [
    {
      "rank": 1,
      "start": 120,
      "end": 150,
      "score": 9,
      "reason": "strong controversial opinion"
    }
  ]
}
```

## Docs

See [docs/plan.md](docs/plan.md) for the full architecture and build plan.
