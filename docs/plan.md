# YouTube Interesting Segment Finder — Build Plan

## 1. Goal

Build a system that:

1. Takes a **YouTube URL**
2. Extracts the **transcript with timestamps**
3. Downloads the **video** (for clip generation)
4. Uses an **LLM to analyze the transcript**
5. Identifies **interesting/high-value moments**
6. Returns **timestamp ranges**
7. Optionally **cuts clips automatically**

---

## 2. System Architecture

```
User Input (YouTube URL)
        │
        ▼
Module 1 — URL Parser
        │
        ▼
Module 2 — Video Metadata Extractor
        │
        ▼
Module 3 — Transcript Fetcher + Micro-block Grouper
        │
        ▼
Module 4 — LLM Chunk Builder
        │
        ▼
Module 5 — LLM Segment Analyzer (parallel)
        │
        ▼
Module 6 — Segment Ranking
        │
        ▼
Module 7 — Clip Refinement Pass
        │
        ▼
Module 8 — Video Downloader (yt-dlp)
        │
        ▼
Module 9 — Clip Generator (ffmpeg, optional)
```

---

## 3. Modules

### Module 1 — URL Parser

Input:

```
https://youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
```

Output:

```
VIDEO_ID
```

Requirements:

- Support `youtube.com/watch`
- Support `youtu.be`
- Validate video ID length (must be exactly 11 characters)
- Raise a clear error on invalid input

---

### Module 2 — Video Metadata Extractor

Use `yt-dlp` to fetch:

- Title
- Duration (seconds)
- Available caption tracks

This step determines whether transcript is available before doing any further work.

---

### Module 3 — Transcript Fetcher + Micro-block Grouper

**Fetching:**

Use the [`youtube-transcript`](https://www.npmjs.com/package/youtube-transcript) npm package.

```ts
import { YoutubeTranscript } from 'youtube-transcript';

const lines = await YoutubeTranscript.fetchTranscript(videoId);
```

Raw format returned (note: `offset` in ms, not `start` in seconds):

```json
[
  {
    "text": "Hello everyone welcome to the video",
    "offset": 0,
    "duration": 3500
  }
]
```

Normalize to seconds immediately after fetching:

```ts
const normalized = lines.map((line) => ({
  text: line.text,
  start: line.offset / 1000,
  duration: line.duration / 1000,
}));
```

**Micro-block grouping:**

Individual transcript lines are very short and noisy. Group them into **10-20 second micro-blocks** for cleaner downstream processing:

```
[00:00-00:20] Intro discussion about the topic
[00:20-00:40] Explanation of the core concept
```

Output format per micro-block:

```json
{
  "start": 0,
  "end": 20,
  "text": "combined text of lines in this window"
}
```

> **Why two levels?** Micro-blocks (10-20s) are used to group raw lines into readable units. LLM chunks (see Module 4) are larger windows (60-120s) used for semantic analysis. Both are needed: micro-blocks reduce noise, LLM chunks provide enough context for the model to judge interestingness.

---

### Module 4 — LLM Chunk Builder

Group micro-blocks into larger **LLM analysis chunks**:

```
chunk_length = 60–120 seconds
overlap      = 20 seconds
```

The overlap prevents missing interesting moments that span a chunk boundary.

Example:

```
Chunk 1: 0s   – 120s
Chunk 2: 100s – 220s
Chunk 3: 200s – 320s
```

Output per chunk:

```json
{
  "start": 120,
  "end": 240,
  "text": "combined micro-block text for this window..."
}
```

---

### Module 5 — LLM Segment Analyzer

Send each chunk to the LLM **in parallel** using `Promise.all` for cost and time efficiency.

Use the Vercel AI SDK's `generateObject` with a Zod schema — this eliminates manual JSON parsing and removes the need for retry-on-malformed-JSON logic entirely. The SDK handles structured output natively.

```ts
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const SegmentSchema = z.object({
  interesting: z.boolean(),
  score: z.number().min(1).max(10),
  reason: z.string(),
  clip_start: z.number(),
  clip_end: z.number(),
});

const { object } = await generateObject({
  model: openai('gpt-4o'),
  schema: SegmentSchema,
  prompt: buildPrompt(chunk),
});
```

Prompt template:

```
You are an expert video editor.

Given a transcript segment from a YouTube video, identify
if this segment contains a potentially interesting moment.

Interesting moments include:
- surprising insights
- strong opinions
- humor
- storytelling
- emotional moments
- key explanations
- controversial takes

Transcript Segment:
START: {start_time}
END: {end_time}

{transcript}
```

**Error handling:**

If `generateObject` throws (network error, model refusal, etc.), catch per-chunk and log a warning — don't fail the entire run:

```ts
const results = await Promise.allSettled(chunks.map((chunk) => analyzeChunk(chunk)));
const successful = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
```

---

### Module 6 — Segment Ranking

After collecting all LLM results:

**Filter:**

```
score >= SCORE_THRESHOLD  (default: 7, configurable per run)
```

> The default threshold of 7 works for general content. For comedy or reaction videos, consider lowering to 6. For technical/educational content, 7-8 is appropriate. Expose this as a config option rather than hardcoding.

**Sort:**

```
score DESC
```

**Keep:**

```
top N segments  (default: 5–10, configurable)
```

**Deduplicate overlapping segments:**

If two segments overlap by more than 50% of their duration, keep the one with the higher score.

---

### Module 7 — Clip Refinement Pass

Run a second LLM pass on top-ranked segments to tighten boundaries.

Prompt:

```
You are refining clip timestamps.

Goal: make the clip start slightly before the interesting moment
and end slightly after it, so it has natural entry and exit points.

Current clip:
START: {start}
END: {end}

Transcript context (broader window around the clip):

{context}

Return JSON only:

{
  "clip_start": seconds,
  "clip_end": seconds
}
```

---

### Module 8 — Video Downloader

Use `yt-dlp` via [`execa`](https://www.npmjs.com/package/execa) to download the video **only after** segments are ranked (avoid downloading if no good segments are found).

Supports two download modes:

**Full video mode** (default):

```ts
import { execa } from 'execa';

await execa('yt-dlp', [
  '-f',
  'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
  '-o',
  `downloads/${videoId}.%(ext)s`,
  `https://www.youtube.com/watch?v=${videoId}`,
]);
```

**Segments mode** (top N segments only):

```ts
await execa('yt-dlp', [
  '-f',
  'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
  '--download-sections',
  `*${start}.${end}`, // HH:MM:SS.mmm format for millisecond precision
  '-o',
  `downloads/${videoId}_${start}_${end}.mp4`,
  `https://www.youtube.com/watch?v=${videoId}`,
]);
```

**Key features:**

- **Millisecond precision**: Segments mode uses HH:MM:SS.mmm format to preserve exact timestamps (e.g., 120.5s → 00:02:00.500)
- **Timestamp offset**: `TIMESTAMP_OFFSET_SECONDS` config option applies global adjustment to all timestamps (positive = later, negative = earlier)
- **Pre-downloaded video support**: Detects existing video in `downloads/{VIDEO_ID}.mp4` and skips download
- **Enhanced logging**: Shows requested, adjusted, and final timestamps for debugging sync issues

Store path(s) as:

```
downloads/{VIDEO_ID}.mp4  // full mode
downloads/{VIDEO_ID}_{start}_{end}.mp4  // segments mode
```

---

### Module 9 — Clip Generator (Optional)

Two modes of operation:

**Full video mode** — Use [`fluent-ffmpeg`](https://www.npmjs.com/package/fluent-ffmpeg) to cut each ranked segment:

```ts
import ffmpeg from 'fluent-ffmpeg';

ffmpeg(`downloads/${videoId}.mp4`)
  .setStartTime(clipStart + TIMESTAMP_OFFSET_SECONDS)
  .setDuration(clipEnd - clipStart)
  .outputOptions('-c:v', 'libx264')
  .outputOptions('-preset', FFMPEG_PRESET) // Configurable: ultrafast, superfast, veryfast, fast (default), medium, slow, slower
  .outputOptions('-c:a', 'aac')
  .output(`outputs/${videoId}_${clipStart}_${clipEnd}.mp4`)
  .run();
```

**Segments mode** — Organize pre-downloaded segment files from downloads/ to outputs/:

```ts
await fs.copyFile(
  `downloads/${videoId}_${start}_${end}.mp4`,
  `outputs/${videoId}_${start}_${end}.mp4`,
);
```

**Key features:**

- **Re-encoding for sync**: Uses libx264 (video) and aac (audio) instead of stream copy (`-c copy`) to ensure perfect audio/video synchronization
- **Timestamp offset**: `TIMESTAMP_OFFSET_SECONDS` applies global adjustment to fix systematic transcript-video misalignment
- **Quality preset**: `FFMPEG_PRESET` config option allows speed/quality trade-off (faster = lower quality)
- **Enhanced logging**: Shows adjusted timestamps and durations for troubleshooting
- **Pre-downloaded video**: Can work with existing video file without re-downloading

> Re-encoding with libx264 (video) and aac (audio) ensures perfect audio/video synchronization. This is slower than stream copy mode but prevents desync issues common with keyframe-based cuts. Use the `FFMPEG_PRESET` config option to adjust speed/quality trade-off (ultrafast, superfast, veryfast, fast, medium, slow, slower).

> **Transcript-video misalignment**: If audio is consistently delayed or early across all clips, use `TIMESTAMP_OFFSET_SECONDS` (e.g., -3 for 3-second delay) to compensate. Common with auto-generated captions.

---

## 4. Error Handling

| Scenario                                 | Behavior                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| No transcript available                  | Return error: `"No transcript found for this video"`. Suggest checking if captions are enabled. |
| Auto-generated only (no manual captions) | Proceed with auto-generated but warn the user — accuracy may be lower.                          |
| Video too long (> 3 hours)               | Warn user about high LLM cost. Optionally add a `--max-duration` flag to abort.                 |
| LLM returns malformed JSON               | Retry once with stricter prompt. Skip chunk on second failure.                                  |
| LLM API rate limit hit                   | Exponential backoff with jitter (max 3 retries).                                                |
| yt-dlp download fails                    | Return error with reason (private video, geo-blocked, etc.).                                    |
| ffmpeg not installed                     | Return clear error: `"ffmpeg is required for clip generation. Install it first."`               |
| Cache read error                         | Warn user, proceed with fresh fetch.                                                            |
| Cache write error                        | Warn user, continue (no impact on current run).                                                 |

---

## 5b. Caching

To speed up repeated runs, the CLI caches:

- **Transcript cache**: Per-video JSON files containing normalized transcript lines
- **LLM chunk cache**: Stores successful chunk analyses (chunk hash → LLM result)

Cache behavior:

- Enabled by default (`DUMP_OUTPUTS=true`)
- Automatic cache hit detection on re-runs
- `--no-cache` flag bypasses all caching
- `CACHE_DIR` defaults to `outputs/cache`

Cache file structure:

```
outputs/cache/
  transcript/
    abc123.json          # transcript lines for video abc123
  chunks/
    abc123/
      chunk_0_120.json  # LLM result for chunk 0-120s
      chunk_100_220.json # LLM result for chunk 100-220s
```

---

## 5. Configuration

All tunable parameters live in a `.env` file and are validated at startup using `zod` — the process exits immediately with a clear error if any required value is missing or invalid.

`.env`:

```env
# Provider selection
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key_here

# Model & LLM parameters
LLM_MODEL=gpt-4o
LLM_MAX_RETRIES=3
LLM_CONCURRENCY=3
LLM_SYSTEM_PROMPT=

# Analysis parameters
SCORE_THRESHOLD=7
TOP_N_SEGMENTS=10
CHUNK_LENGTH_SEC=120
CHUNK_OVERLAP_SEC=20
MICRO_BLOCK_SEC=15
MAX_CHUNKS=

# Paths
DOWNLOAD_DIR=downloads/
OUTPUT_DIR=outputs/
CACHE_DIR=outputs/cache

# Output options
DUMP_OUTPUTS=true
```

`src/config/env.ts`:

```ts
import 'dotenv/config';
import { ConfigSchema } from '../types/config.js';

const LLM_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'xai',
  'mistral',
  'groq',
  'zai',
  'openrouter',
] as const;

const PROVIDER_KEY_MAP: Record<LLMProvider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  xai: 'XAI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  groq: 'GROQ_API_KEY',
  zai: 'ZAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

const ConfigSchema = z
  .object({
    LLM_PROVIDER: z.enum(LLM_PROVIDERS).default('openai'),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    XAI_API_KEY: z.string().optional(),
    MISTRAL_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    ZAI_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    SCORE_THRESHOLD: z.coerce.number().min(1).max(10).default(7),
    TOP_N_SEGMENTS: z.coerce.number().min(1).default(10),
    CHUNK_LENGTH_SEC: z.coerce.number().min(10).default(120),
    CHUNK_OVERLAP_SEC: z.coerce.number().min(0).default(20),
    MICRO_BLOCK_SEC: z.coerce.number().min(5).default(15),
    LLM_MODEL: z.string().default('gpt-4o'),
    LLM_MAX_RETRIES: z.coerce.number().min(0).default(3),
    DOWNLOAD_DIR: z.string().default('downloads/'),
    OUTPUT_DIR: z.string().default('outputs/'),
    CACHE_DIR: z.string().default('outputs/cache'),
    DUMP_OUTPUTS: z.coerce.boolean().default(true),
    MAX_CHUNKS: z.coerce.number().min(1).optional(),
    LLM_CONCURRENCY: z.coerce.number().min(1).default(3),
    LLM_SYSTEM_PROMPT: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const provider = data.LLM_PROVIDER;
    const keyName = PROVIDER_KEY_MAP[provider];
    const keyValue = data[keyName as keyof typeof data] as string | undefined;

    if (!keyValue || keyValue.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [keyName],
        message: `${keyName} is required when LLM_PROVIDER is "${provider}"`,
      });
    }
  });

export const config = ConfigSchema.parse(process.env);
```

**Cost estimate:** At ~500 tokens per chunk and ~1 chunk per 2 minutes of video, a 30-minute video generates ~15 chunks. At GPT-4o pricing (~$5/1M input tokens), a full run costs roughly **$0.04–0.10** per video. Free models via OpenRouter reduce this to zero.

### Multi-Provider LLM Support

The CLI supports 8 LLM providers:

| Provider   | API Key Env Var                | Sample Models                                                      |
| ---------- | ------------------------------ | ------------------------------------------------------------------ |
| openai     | `OPENAI_API_KEY`               | gpt-4o, gpt-4o-mini, gpt-4-turbo                                   |
| anthropic  | `ANTHROPIC_API_KEY`            | claude-sonnet-4-5, claude-opus-4, claude-haiku-3-5                 |
| google     | `GOOGLE_GENERATIVE_AI_API_KEY` | gemini-2.0-flash, gemini-1.5-pro                                   |
| xai        | `XAI_API_KEY`                  | grok-beta, grok-2                                                  |
| mistral    | `MISTRAL_API_KEY`              | mistral-large-latest, mistral-small-latest                         |
| groq       | `GROQ_API_KEY`                 | llama-3.3-70b-versatile, llama-3.1-8b-instant                      |
| zai        | `ZAI_API_KEY`                  | glm-5, glm-4.7, glm-4.6, glm-5-turbo                               |
| openrouter | `OPENROUTER_API_KEY`           | meta-llama/llama-3.3-70b-instruct:free, google/gemma-3-27b-it:free |

Set `LLM_PROVIDER` in `.env` to choose your provider. The corresponding API key is required.

See `docs/free-models.md` for free model options via OpenRouter.

---

## 6. Final Output Format

```json
{
  "video_id": "abc123",
  "title": "Video Title Here",
  "duration": 1823,
  "segments": [
    {
      "rank": 1,
      "start": 120,
      "end": 150,
      "score": 9,
      "reason": "strong controversial opinion about X"
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

---

## 7. Tech Stack

| Layer                 | Choice                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Language              | TypeScript (Node.js 18+)                                                                                                                               |
| HTTP layer            | None yet — CLI-first. API layer added later.                                                                                                           |
| Transcript            | [`youtube-transcript`](https://www.npmjs.com/package/youtube-transcript) npm package                                                                   |
| Video download        | `yt-dlp` subprocess via [`execa`](https://www.npmjs.com/package/execa)                                                                                 |
| Clip cutting          | `ffmpeg` subprocess via [`fluent-ffmpeg`](https://www.npmjs.com/package/fluent-ffmpeg)                                                                 |
| LLM                   | Vercel AI SDK (`ai` + `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/xai`, `@ai-sdk/mistral`, `@ai-sdk/groq`, `@ai-sdk/openrouter`) |
| Structured LLM output | `generateObject` + `zod` schema (no manual JSON parsing needed)                                                                                        |
| Config validation     | `zod` — parse and validate all env vars at startup                                                                                                     |
| Async workers         | `Promise.all` / `Promise.allSettled` for parallel LLM calls                                                                                            |
| Concurrency control   | `p-limit`                                                                                                                                              |
| Job queue (optional)  | Redis + `bullmq`                                                                                                                                       |

---

## 8. Example Flow

```
Input: https://youtube.com/watch?v=abc123

1. Parse URL              → videoId = "abc123"
2. Fetch metadata         → duration = 1823s, title = "..."
3. Fetch transcript       → 312 raw lines (normalize offset→seconds) [check cache first]
4. Build micro-blocks     → 91 blocks @ ~20s each
5. Build LLM chunks       → 16 chunks @ ~120s with 20s overlap
6. Parallel LLM analysis  → Promise.allSettled(chunks.map(analyzeChunk)) [max 3 concurrent]
7. Rank segments          → 4 segments with score >= 7
8. Refinement pass        → tighten boundaries on top 4
9. Download video         → downloads/abc123.mp4  (via yt-dlp + execa)
10. Generate clips        → outputs/abc123_120_150.mp4, ...  (via fluent-ffmpeg)

Output: JSON with 4 ranked segments
```

---

## 9. Phase 2 — Advanced Features

### Smarter segmentation (recommended upgrade)

Instead of fixed-size time windows, use **sentence boundaries + topic change detection**:

- Embed transcript sentences with a lightweight model (e.g. `sentence-transformers`)
- Detect topic shifts via cosine similarity drops between consecutive embeddings
- Use these semantic boundaries as chunk boundaries instead of fixed time windows

This improves highlight detection quality and reduces LLM cost by ~90% (fewer, better-targeted chunks).

### Hook phrase detection

Detect high-signal phrases before sending to LLM:

```
"this changed everything"
"the crazy part is"
"what nobody tells you"
"I've never told anyone this"
```

Use these as boosters on the final score.

### Emotion spike detection

Keyword-based pre-filter to flag candidate segments:

```
crazy, insane, unbelievable, shocking, hilarious, never, always
```

### Viral clip scoring formula (Phase 2)

```
final_score =
  llm_score * 0.5 +
  curiosity_score * 0.2 +
  emotion_score * 0.2 +
  novelty_score * 0.1
```

### Silence trimming

Use `ffmpeg` silence detection to trim dead air at the start/end of each clip:

```bash
ffmpeg -i clip.mp4 -af silenceremove=start_periods=1:start_silence=0.5 trimmed.mp4
```
