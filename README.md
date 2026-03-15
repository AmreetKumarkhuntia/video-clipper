# video-clipper

A TypeScript CLI tool that takes a YouTube URL, analyzes the transcript with an LLM, and returns the most interesting moments as ranked timestamp ranges. Optionally downloads the video and cuts clips automatically.

## How it works

```
YouTube URL
    │
    ▼
Parse URL → fetch transcript → group into chunks
    │
    ▼
Parallel LLM analysis (Vercel AI SDK + gpt-4o)
    │
    ▼
Rank & deduplicate segments
    │
    ▼
Refine clip boundaries (second LLM pass)
    │
    ▼
(Optional) Download video + cut clips with ffmpeg
```

## Tech Stack

| Layer             | Choice                                  |
| ----------------- | --------------------------------------- |
| Language          | TypeScript (Node.js 18+)                |
| Transcript        | `youtube-transcript`                    |
| LLM               | Vercel AI SDK (`ai` + `@ai-sdk/openai`) |
| Structured output | `generateObject` + `zod`                |
| Video download    | `yt-dlp` via `execa`                    |
| Clip cutting      | `fluent-ffmpeg`                         |
| Config validation | `zod`                                   |

## Requirements

- Node.js 18+
- `yt-dlp` (for video download)
- `ffmpeg` (for clip cutting)

```bash
# macOS
brew install yt-dlp ffmpeg
```

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=your_key_here
```

## Configuration

All parameters are set via `.env`:

| Variable            | Default      | Description                            |
| ------------------- | ------------ | -------------------------------------- |
| `OPENAI_API_KEY`    | —            | Required. Your OpenAI API key.         |
| `SCORE_THRESHOLD`   | `7`          | Minimum score (1–10) to keep a segment |
| `TOP_N_SEGMENTS`    | `10`         | Max number of segments to return       |
| `CHUNK_LENGTH_SEC`  | `120`        | LLM analysis window size in seconds    |
| `CHUNK_OVERLAP_SEC` | `20`         | Overlap between consecutive chunks     |
| `MICRO_BLOCK_SEC`   | `15`         | Transcript grouping window in seconds  |
| `LLM_MODEL`         | `gpt-4o`     | Model to use                           |
| `LLM_MAX_RETRIES`   | `3`          | Max retries on LLM failure             |
| `DOWNLOAD_DIR`      | `downloads/` | Where to store downloaded videos       |
| `OUTPUT_DIR`        | `outputs/`   | Where to store generated clips         |

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
    },
    {
      "rank": 2,
      "start": 420,
      "end": 455,
      "score": 8,
      "reason": "funny storytelling moment"
    }
  ]
}
```

## Docs

Full architecture and build plan: [docs/plan.md](docs/plan.md)
