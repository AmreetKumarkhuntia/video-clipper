# Configuration Reference

## Tech Stack

| Layer             | Choice                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language          | TypeScript (Node.js 18+)                                                                                                                                      |
| Transcript        | `youtube-transcript`, `yt-dlp`, Whisper, Gemini                                                                                                               |
| LLM               | Vercel AI SDK (`ai` + `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/xai`, `@ai-sdk/mistral`, `@ai-sdk/groq`, `@ai-sdk/openai-compatible`) |
| Structured output | `generateObject` + `zod`                                                                                                                                      |
| Video download    | `yt-dlp` via `execa`                                                                                                                                          |
| Clip cutting      | `fluent-ffmpeg`                                                                                                                                               |
| Config validation | `zod`                                                                                                                                                         |
| Concurrency       | `p-limit`                                                                                                                                                     |

## Environment Variables

All configuration is via `.env`. Copy `.env.example` to get started:

```bash
cp .env.example .env
```

### Provider Selection

| Variable                       | Default  | Description                                                                                            |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------ |
| `LLM_PROVIDER`                 | `openai` | LLM provider: `openai`, `anthropic`, `google`, `xai`, `mistral`, `groq`, `zai`, `openrouter`, `custom` |
| `OPENAI_API_KEY`               | —        | Required when `LLM_PROVIDER=openai`                                                                    |
| `ANTHROPIC_API_KEY`            | —        | Required when `LLM_PROVIDER=anthropic`                                                                 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | —        | Required when `LLM_PROVIDER=google`                                                                    |
| `XAI_API_KEY`                  | —        | Required when `LLM_PROVIDER=xai`                                                                       |
| `MISTRAL_API_KEY`              | —        | Required when `LLM_PROVIDER=mistral`                                                                   |
| `GROQ_API_KEY`                 | —        | Required when `LLM_PROVIDER=groq`                                                                      |
| `ZAI_API_KEY`                  | —        | Required when `LLM_PROVIDER=zai`                                                                       |
| `OPENROUTER_API_KEY`           | —        | Required when `LLM_PROVIDER=openrouter`                                                                |
| `CUSTOM_OPENAI_API_KEY`        | —        | Required when `LLM_PROVIDER=custom`                                                                    |
| `CUSTOM_OPENAI_BASE_URL`       | —        | Required when `LLM_PROVIDER=custom` (base URL for OpenAI-compatible endpoint)                          |

### Model & LLM

| Variable            | Default          | Description                                 |
| ------------------- | ---------------- | ------------------------------------------- |
| `LLM_MODEL`         | `gpt-4o`         | Model ID (must match the selected provider) |
| `LLM_MAX_RETRIES`   | `3`              | Max retries on rate-limit errors            |
| `LLM_CONCURRENCY`   | `3`              | Max parallel LLM calls                      |
| `LLM_SYSTEM_PROMPT` | (default prompt) | Custom system prompt for LLM analysis       |

### Analysis Parameters

| Variable            | Default | Description                                   |
| ------------------- | ------- | --------------------------------------------- |
| `SCORE_THRESHOLD`   | `7`     | Minimum score (1–10) to keep a segment        |
| `TOP_N_SEGMENTS`    | `10`    | Max number of segments to return              |
| `CHUNK_LENGTH_SEC`  | `120`   | LLM analysis window size in seconds           |
| `CHUNK_OVERLAP_SEC` | `20`    | Overlap between consecutive chunks in seconds |
| `MICRO_BLOCK_SEC`   | `15`    | Transcript grouping window in seconds         |
| `MAX_CHUNKS`        | —       | Limit number of chunks sent to LLM (optional) |

### Audio Detection

| Variable                     | Default            | Description                                                       |
| ---------------------------- | ------------------ | ----------------------------------------------------------------- |
| `AUDIO_DETECTION_ENABLED`    | `true`             | Enable/disable audio event detection                              |
| `AUDIO_PROVIDER`             | `gemini,whisper`   | Ordered fallback chain: `gemini`, `whisper`, `yamnet`             |
| `AUDIO_WHISPER_MODEL`        | `medium`           | Whisper model size: `tiny`, `base`, `small`, `medium`, `large-v3` |
| `AUDIO_GEMINI_MODEL`         | `gemini-2.5-flash` | Gemini model used for audio analysis                              |
| `AUDIO_CONFIDENCE_THRESHOLD` | `0.3`              | Minimum confidence (0–1) for an audio event to be kept            |
| `AUDIO_CLIP_PRE_ROLL`        | `5`                | Seconds before an audio event to include in the segment           |
| `AUDIO_CLIP_POST_ROLL`       | `15`               | Seconds after an audio event to include in the segment            |
| `AUDIO_LLM_BOOST_WINDOW`     | `10`               | Seconds around an audio event where LLM score gets boosted        |
| `AUDIO_LLM_SCORE_BOOST`      | `2`                | Score bonus applied to LLM segments that overlap an audio event   |
| `AUDIO_EXTRA_INSTRUCTIONS`   | —                  | Extra instructions appended to the audio analysis prompt          |
| `GAME_PROFILE`               | `general`          | Audio event profile: `valorant`, `fps`, `boss_fight`, `general`   |

### Transcript Provider

| Variable              | Default | Description                                                            |
| --------------------- | ------- | ---------------------------------------------------------------------- |
| `TRANSCRIPT_PROVIDER` | `ytdlp` | Ordered fallback chain: `ytdlp`, `whisper`, `gemini` (comma-separated) |

### Video Download & Clip Cutting

| Variable                   | Default | Description                                                                                            |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `DOWNLOAD_SECTIONS_MODE`   | `all`   | `all` = full video download; `N` = download only top N segments via `--download-sections`              |
| `FFMPEG_PATH`              | —       | Custom path to `ffmpeg` binary (optional)                                                              |
| `FFPROBE_PATH`             | —       | Custom path to `ffprobe` binary (optional)                                                             |
| `FFMPEG_PRESET`            | `fast`  | Encoding preset: `ultrafast`, `superfast`, `veryfast`, `fast`, `medium`, `slow`, `slower`              |
| `TIMESTAMP_OFFSET_SECONDS` | `0`     | Adjust all clip timestamps (positive = later, negative = earlier) — see [audio-sync.md](audio-sync.md) |
| `CLIP_CONCURRENCY`         | `1`     | Max parallel ffmpeg clip jobs                                                                          |

### Paths & Output

| Variable       | Default         | Description                                          |
| -------------- | --------------- | ---------------------------------------------------- |
| `DOWNLOAD_DIR` | `downloads/`    | Where to store downloaded videos                     |
| `OUTPUT_DIR`   | `outputs/`      | Where to store generated clips, audio, and dumps     |
| `CACHE_DIR`    | `outputs/cache` | Where to store transcript and LLM result cache       |
| `DUMP_OUTPUTS` | `true`          | Write transcript/analysis JSON dumps to `OUTPUT_DIR` |

### YouTube / yt-dlp Authentication

| Variable                      | Default | Description                                                                                       |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `YT_DLP_COOKIES_FROM_BROWSER` | —       | Extract cookies from browser: `chrome`, `firefox`, `safari`, `brave`, `edge`, `opera`, `chromium` |
| `YT_DLP_COOKIES_FILE`         | —       | Path to a Netscape-format cookies file for yt-dlp authentication                                  |

> Note: `YT_DLP_COOKIES_FROM_BROWSER` and `YT_DLP_COOKIES_FILE` are mutually exclusive.

## FFmpeg Preset Guide

Clips are re-encoded with `libx264` + `aac` to ensure audio/video sync. Use `FFMPEG_PRESET` to trade speed for quality:

| Preset           | Speed     | Quality | Recommended For        |
| ---------------- | --------- | ------- | ---------------------- |
| `ultrafast`      | Very fast | Lowest  | Quick testing          |
| `fast` (default) | Fast      | Good    | Balanced performance   |
| `medium`         | Medium    | Better  | Higher quality clips   |
| `slow`           | Slow      | High    | Final production clips |

```bash
# Faster processing (lower quality)
FFMPEG_PRESET=ultrafast video-clipper <url> --clip

# Higher quality (slower)
FFMPEG_PRESET=medium video-clipper <url> --clip
```

## Using a Free Model via OpenRouter

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

See [docs/free-models.md](free-models.md) for a curated list of free models that work well with this tool.

## Custom OpenAI-Compatible Endpoint

```env
LLM_PROVIDER=custom
CUSTOM_OPENAI_API_KEY=your_key
CUSTOM_OPENAI_BASE_URL=https://your-endpoint.example.com/v1
LLM_MODEL=your-model-id
```
