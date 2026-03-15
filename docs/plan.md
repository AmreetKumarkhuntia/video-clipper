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

Use `youtube-transcript-api`.

Raw format returned:

```json
[
  {
    "text": "Hello everyone welcome to the video",
    "start": 0.0,
    "duration": 3.5
  }
]
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

Send each chunk to the LLM **in parallel** for cost and time efficiency.

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

Return JSON only, no explanation:

{
  "interesting": true/false,
  "score": 1-10,
  "reason": "why this moment is interesting",
  "clip_start": seconds,
  "clip_end": seconds
}
```

**LLM JSON parse error handling:**

If the LLM returns malformed JSON:
1. Retry once with an explicit instruction: `"You must return only valid JSON. No markdown, no explanation."`
2. If it fails again, skip this chunk and log a warning.

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

Use `yt-dlp` to download the video **only after** segments are ranked (avoid downloading if no good segments are found).

```bash
yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]" \
       -o "downloads/%(id)s.%(ext)s" \
       "https://youtube.com/watch?v=VIDEO_ID"
```

Store path as:

```
downloads/{VIDEO_ID}.mp4
```

---

### Module 9 — Clip Generator (Optional)

Use `ffmpeg` to cut each ranked segment:

```bash
ffmpeg -ss {clip_start} -to {clip_end} -i downloads/{VIDEO_ID}.mp4 \
       -c copy outputs/{VIDEO_ID}_{clip_start}_{clip_end}.mp4
```

> `-c copy` avoids re-encoding for speed. If precise frame cuts are needed, replace with `-c:v libx264 -c:a aac`.

---

## 4. Error Handling

| Scenario | Behavior |
|---|---|
| No transcript available | Return error: `"No transcript found for this video"`. Suggest checking if captions are enabled. |
| Auto-generated only (no manual captions) | Proceed with auto-generated but warn the user — accuracy may be lower. |
| Video too long (> 3 hours) | Warn user about high LLM cost. Optionally add a `--max-duration` flag to abort. |
| LLM returns malformed JSON | Retry once with stricter prompt. Skip chunk on second failure. |
| LLM API rate limit hit | Exponential backoff with jitter (max 3 retries). |
| yt-dlp download fails | Return error with reason (private video, geo-blocked, etc.). |
| ffmpeg not installed | Return clear error: `"ffmpeg is required for clip generation. Install it first."` |

---

## 5. Configuration

All tunable parameters should live in a config file or be passable as CLI/API arguments:

```python
SCORE_THRESHOLD = 7          # minimum score to keep a segment
TOP_N_SEGMENTS = 10          # max segments to return
CHUNK_LENGTH_SEC = 120       # LLM chunk size in seconds
CHUNK_OVERLAP_SEC = 20       # overlap between chunks
MICRO_BLOCK_SEC = 15         # micro-block grouping window
LLM_PROVIDER = "openai"      # openai | anthropic | google
LLM_MODEL = "gpt-4o"
LLM_MAX_RETRIES = 3
DOWNLOAD_DIR = "downloads/"
OUTPUT_DIR = "outputs/"
```

**API key management:** Load from environment variables, never hardcode.

```bash
export OPENAI_API_KEY=...
```

**Cost estimate:** At ~500 tokens per chunk and ~1 chunk per 2 minutes of video, a 30-minute video generates ~15 chunks. At GPT-4o pricing (~$5/1M input tokens), a full run costs roughly **$0.04–0.10** per video.

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

| Layer | Choice |
|---|---|
| Backend | Python / FastAPI |
| Transcript | `youtube-transcript-api` |
| Video download | `yt-dlp` |
| Clip cutting | `ffmpeg` |
| LLM | OpenAI / Anthropic / Google (configurable) |
| Async workers | Python `asyncio` + `asyncio.gather` for parallel LLM calls |
| Job queue (optional) | Redis + `rq` or Celery |

---

## 8. Example Flow

```
Input: https://youtube.com/watch?v=abc123

1. Parse URL              → video_id = "abc123"
2. Fetch metadata         → duration = 1823s, title = "..."
3. Fetch transcript       → 312 raw lines
4. Build micro-blocks     → 91 blocks @ ~20s each
5. Build LLM chunks       → 16 chunks @ ~120s with 20s overlap
6. Parallel LLM analysis  → 16 API calls (async)
7. Rank segments          → 4 segments with score >= 7
8. Refinement pass        → tighten boundaries on top 4
9. Download video         → downloads/abc123.mp4
10. Generate clips        → outputs/abc123_120_150.mp4, ...

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
