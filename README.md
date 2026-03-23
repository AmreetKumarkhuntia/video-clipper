# @thunderkiller/video-clipper

A TypeScript CLI (and library) that analyzes a YouTube video with an LLM, finds the most interesting moments, and optionally downloads the video and cuts clips automatically.

## How It Works

```
YouTube URL
    │
    ▼
Parse URL → fetch transcript → group into chunks
    │
    ▼
Parallel LLM analysis (Vercel AI SDK — OpenAI, Anthropic, Google, and more)
    │
    ▼
Merge with audio event detection → rank & deduplicate segments
    │
    ▼
Refine clip boundaries (second LLM pass)
    │
    ▼
(Optional) Download video + cut clips with ffmpeg
```

## Requirements

- Node.js 18+
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) — for video download
- [`ffmpeg`](https://ffmpeg.org) — for clip cutting

```bash
# macOS
brew install yt-dlp ffmpeg
```

## Installation

```bash
# Global CLI
npm install -g @thunderkiller/video-clipper

# One-off with npx (no install)
npx @thunderkiller/video-clipper <url>

# As a library
npm install @thunderkiller/video-clipper
```

## Quick Start

**1. Configure your LLM provider**

Create a `.env` file in your working directory:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Or use a free model via OpenRouter:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

**2. Run**

```bash
# Analyze only — prints ranked segments as JSON
video-clipper https://youtube.com/watch?v=VIDEO_ID

# Analyze and cut clips (downloads video, runs ffmpeg)
video-clipper https://youtube.com/watch?v=VIDEO_ID --clip

# Download only the top 3 segments (faster than full video)
video-clipper https://youtube.com/watch?v=VIDEO_ID --download-sections 3
```

## CLI Flags

| Flag                       | Description                                                              |
| -------------------------- | ------------------------------------------------------------------------ |
| `--clip`                   | Download video and generate mp4 clips for each segment                   |
| `--download-sections <n>`  | Download only top N segments via yt-dlp `--download-sections` (e.g. `3`) |
| `--local-video <path>`     | Cut clips from a local video file — skips yt-dlp download entirely       |
| `--video-path <path>`      | Custom output directory for downloaded videos and clips                  |
| `--threshold <n>`          | Minimum score (1–10) to keep a segment (default: `7`)                    |
| `--top-n <n>`              | Maximum number of segments to return (default: `10`)                     |
| `--max-duration <s>`       | Abort if video is longer than N seconds                                  |
| `--max-chunks <n>`         | Limit number of transcript chunks sent to LLM                            |
| `--max-parallel <n>`       | Max parallel LLM calls                                                   |
| `--no-audio`               | Disable audio event detection (transcript-only mode)                     |
| `--game-profile <profile>` | Audio event profile: `valorant`, `fps`, `boss_fight`, `general`          |
| `--output-json <path>`     | Write output JSON to file instead of stdout                              |
| `--no-cache`               | Bypass all caches and force a fresh run                                  |
| `--help, -h`               | Show help message                                                        |

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
      "reason": "strong controversial opinion",
      "source": "transcript"
    },
    {
      "rank": 2,
      "start": 420,
      "end": 455,
      "score": 8,
      "reason": "funny storytelling moment",
      "source": "both"
    }
  ]
}
```

## Programmatic API

```typescript
import { runPipeline, parseArgs, config } from '@thunderkiller/video-clipper';

const args = parseArgs(process.argv);
await runPipeline(args);
```

All public types and Zod schemas are exported from the package root. See [src/lib.ts](src/lib.ts) for the full surface.

## Documentation

| Doc                                              | Description                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| [docs/configuration.md](docs/configuration.md)   | Full environment variable reference, provider setup, FFmpeg presets   |
| [docs/advanced-usage.md](docs/advanced-usage.md) | Advanced CLI examples, caching, pre-downloaded videos                 |
| [docs/audio-sync.md](docs/audio-sync.md)         | Audio/video sync troubleshooting and `TIMESTAMP_OFFSET_SECONDS` guide |
| [docs/yt-downloader.md](docs/yt-downloader.md)   | yt-dlp download modes explained                                       |
| [docs/free-models.md](docs/free-models.md)       | Free models that work well with this tool                             |
| [docs/plan.md](docs/plan.md)                     | Full architecture and pipeline design                                 |
