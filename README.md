# Video Clipper

[![CI](https://github.com/AmreetKumarkhuntia/video-clipper/actions/workflows/ci.yml/badge.svg)](https://github.com/AmreetKumarkhuntia/video-clipper/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/vdclip.svg)](https://www.npmjs.com/package/vdclip)
[![license](https://img.shields.io/npm/l/vdclip.svg)](https://github.com/AmreetKumarkhuntia/video-clipper/blob/master/LICENSE)

A TypeScript backend, web app, and CLI that analyze YouTube videos with an LLM, find interesting moments, and generate clips. The `vdclip` npm package contains only the CLI; analysis, storage, source downloads, and rendering run on the backend.

For installation and login, see the [CLI guide](packages/cli/README.md). Package build and release instructions are in [CLI distribution](docs/guides/cli-distribution.md).

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

## Requirements for self-hosting

- Node.js 22+ for the installed CLI; Node.js 24 for repository build and release tooling
- PostgreSQL 17 for backend persistence
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) — for video download
- [`ffmpeg`](https://ffmpeg.org) — for clip cutting

```bash
# macOS
brew install yt-dlp ffmpeg
```

## Installation

```bash
# Global CLI
npm install -g vdclip

# Connect to a running backend and sign in
export VIDEO_CLIPPER_API_URL=https://your-backend.example
vdclip login

# One-off with npx (no install)
npx vdclip analyze <url>
```

## Quick Start

**1. Configure the backend's LLM provider (self-hosting only)**

Create a `.env` file in the backend repository. CLI users connecting to a hosted backend do not need provider keys:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://video_clipper:video_clipper@127.0.0.1:5432/video_clipper
TOKEN_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
```

Or use a free model via OpenRouter:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

**2. Provision PostgreSQL, migrate it, then start the apps (self-hosting only)**

Create the development role and database once. Use the password you placed in `DATABASE_URL` when
`createuser` prompts for it:

```bash
createuser --login --pwprompt video_clipper
createdb --owner=video_clipper video_clipper
```

Then apply migrations and start the backend:

```bash
pnpm db:migrate
pnpm api:dev
# In another terminal:
pnpm web:dev
```

Configure browser sign-in as described in the [configuration guide](docs/guides/configuration.md).
Run `pnpm db:migrate` once before each release that contains schema changes; API replicas never run
migrations automatically.

**3. Sign in and run the client**

```bash
vdclip login

# Analyze on the backend
vdclip https://youtube.com/watch?v=VIDEO_ID

# Analyze and cut clips on the backend
vdclip https://youtube.com/watch?v=VIDEO_ID --clip

# Download only the top 3 segments (faster than full video)
vdclip https://youtube.com/watch?v=VIDEO_ID --download-sections 3
```

## CLI Flags

| Flag                       | Description                                                                |
| -------------------------- | -------------------------------------------------------------------------- |
| `--clip`                   | Download video and generate mp4 clips for each segment                     |
| `--download-sections <n>`  | Download only top N segments via yt-dlp `--download-sections` (e.g. `3`)   |
| `--local-video <path>`     | Legacy server-side source path; cannot read a file on a remote CLI machine |
| `--video-path <path>`      | Legacy server-side output directory                                        |
| `--threshold <n>`          | Minimum score (1–10) to keep a segment (default: `7`)                      |
| `--top-n <n>`              | Maximum number of segments to return (default: `10`)                       |
| `--max-duration <s>`       | Abort if video is longer than N seconds                                    |
| `--max-chunks <n>`         | Limit number of transcript chunks sent to LLM                              |
| `--max-parallel <n>`       | Max parallel LLM calls                                                     |
| `--no-audio`               | Deprecated — ignored (`run` no longer performs audio event detection)      |
| `--game-profile <profile>` | Deprecated — ignored                                                       |
| `--output-json <path>`     | Write output JSON to file instead of stdout                                |
| `--no-cache`               | Re-analyze every chunk, ignoring stored LLM results (transcript reused)    |
| `--help, -h`               | Show help message                                                          |

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

The `vdclip` package exposes only the command-line client. Integrations should use the backend HTTP API; shared contracts live in [src/lib/types/api.ts](src/lib/types/api.ts). The internal domain library remains in [src/lib/index.ts](src/lib/index.ts) for server development in this repository, and the existing `@thunderkiller/video-clipper` publication remains unchanged.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/) — enforced by commitlint
4. Push and open a Pull Request

Pre-commit hooks run automatically: formatting (Prettier), type-check, and tests. Make sure `yt-dlp` and `ffmpeg` are installed locally.

## Documentation

| Doc                                                            | Description                                                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [docs/guides/configuration.md](docs/guides/configuration.md)   | Full environment variable reference, provider setup, FFmpeg presets, yt-dlp cookie auth guide |
| [docs/guides/advanced-usage.md](docs/guides/advanced-usage.md) | Advanced CLI examples, caching, pre-downloaded videos                                         |
| [docs/guides/audio-sync.md](docs/guides/audio-sync.md)         | Audio/video sync troubleshooting and `TIMESTAMP_OFFSET_SECONDS` guide                         |
| [docs/guides/yt-downloader.md](docs/guides/yt-downloader.md)   | yt-dlp download modes, transcript bot-detection errors, and cookie troubleshooting            |
| [docs/guides/free-models.md](docs/guides/free-models.md)       | Free models that work well with this tool                                                     |
| [docs/README.md](docs/README.md)                               | Docs index: guides, design assets, active and archived plans                                  |
