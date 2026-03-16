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

| Layer             | Choice                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Language          | TypeScript (Node.js 18+)                                                                                                                               |
| Transcript        | `youtube-transcript`                                                                                                                                   |
| LLM               | Vercel AI SDK (`ai` + `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/xai`, `@ai-sdk/mistral`, `@ai-sdk/groq`, `@ai-sdk/openrouter`) |
| Structured output | `generateObject` + `zod`                                                                                                                               |
| Video download    | `yt-dlp` via `execa`                                                                                                                                   |
| Clip cutting      | `fluent-ffmpeg`                                                                                                                                        |
| Config validation | `zod`                                                                                                                                                  |
| Concurrency       | `p-limit`                                                                                                                                              |

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

Edit `.env` and configure your LLM provider:

```env
# Choose your provider (openai, anthropic, google, xai, mistral, groq, zai, openrouter)
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key_here

# Or use a free model via OpenRouter:
# LLM_PROVIDER=openrouter
# OPENROUTER_API_KEY=sk-or-...
# LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

## Configuration

All parameters are set via `.env`:

| Variable                       | Default          | Description                                                                   |
| ------------------------------ | ---------------- | ----------------------------------------------------------------------------- |
| **Provider selection**         |
| `LLM_PROVIDER`                 | `openai`         | LLM provider (openai, anthropic, google, xai, mistral, groq, zai, openrouter) |
| `OPENAI_API_KEY`               | —                | Your OpenAI API key (required if LLM_PROVIDER=openai)                         |
| `ANTHROPIC_API_KEY`            | —                | Your Anthropic API key (required if LLM_PROVIDER=anthropic)                   |
| `GOOGLE_GENERATIVE_AI_API_KEY` | —                | Your Google API key (required if LLM_PROVIDER=google)                         |
| `XAI_API_KEY`                  | —                | Your XAI API key (required if LLM_PROVIDER=xai)                               |
| `MISTRAL_API_KEY`              | —                | Your Mistral API key (required if LLM_PROVIDER=mistral)                       |
| `GROQ_API_KEY`                 | —                | Your Groq API key (required if LLM_PROVIDER=groq)                             |
| `ZAI_API_KEY`                  | —                | Your Zai API key (required if LLM_PROVIDER=zai)                               |
| `OPENROUTER_API_KEY`           | —                | Your OpenRouter API key (required if LLM_PROVIDER=openrouter)                 |
| **Model & LLM**                |
| `LLM_MODEL`                    | `gpt-4o`         | Model ID (depends on provider)                                                |
| `LLM_MAX_RETRIES`              | `3`              | Max retries on rate-limit errors                                              |
| `LLM_CONCURRENCY`              | `3`              | Max parallel LLM calls                                                        |
| `LLM_SYSTEM_PROMPT`            | (default prompt) | Custom system prompt for LLM analysis                                         |
| **Analysis parameters**        |
| `SCORE_THRESHOLD`              | `7`              | Minimum score (1–10) to keep a segment                                        |
| `TOP_N_SEGMENTS`               | `10`             | Max number of segments to return                                              |
| `CHUNK_LENGTH_SEC`             | `120`            | LLM analysis window size in seconds                                           |
| `CHUNK_OVERLAP_SEC`            | `20`             | Overlap between consecutive chunks                                            |
| `MICRO_BLOCK_SEC`              | `15`             | Transcript grouping window in seconds                                         |
| `MAX_CHUNKS`                   | —                | Limit number of chunks sent to LLM (optional)                                 |
| **Paths**                      |
| `DOWNLOAD_DIR`                 | `downloads/`     | Where to store downloaded videos                                              |
| `OUTPUT_DIR`                   | `outputs/`       | Where to store generated clips and dumps                                      |
| `CACHE_DIR`                    | `outputs/cache`  | Where to store transcript and LLM result cache                                |
| **Output options**             |
| `DUMP_OUTPUTS`                 | `true`           | Write transcript/analysis JSON dumps                                          |

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

## Caching

The CLI caches both transcript fetches and LLM chunk results to speed up subsequent runs:

- **Transcript cache**: Stored per video ID in `CACHE_DIR`
- **LLM chunk cache**: Stores successful chunk analyses to avoid re-analyzing the same content

Cache is automatically used on re-runs. Use `--no-cache` to bypass.

## Docs

Full architecture and build plan: [docs/plan.md](docs/plan.md)
