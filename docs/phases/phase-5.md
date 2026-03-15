# Phase 5 — Polish & Error Handling

## Goal

Harden the CLI with proper error handling for all known failure scenarios, add CLI flags
for tunable parameters, improve progress output, and ensure the final JSON matches the spec.

## Deliverable

The CLI handles every error gracefully, never throws an unhandled exception, and the output
JSON matches `docs/plan.md §6` exactly.

---

## Error Handling to Implement

Cover all scenarios from `docs/plan.md §4`:

| Scenario | Required Behavior |
|---|---|
| No transcript available | `[error] No transcript found for this video. Check if captions are enabled.` → exit 1 |
| Auto-generated captions only | `[warn] Only auto-generated captions available — accuracy may be lower.` → continue |
| Video too long (> `--max-duration`) | `[error] Video duration exceeds --max-duration limit.` → exit 1 |
| LLM rate limit hit | Exponential backoff with jitter, max `LLM_MAX_RETRIES` retries, then log + skip chunk |
| `yt-dlp` not installed | `[error] yt-dlp is required. Install it: https://github.com/yt-dlp/yt-dlp` → exit 1 |
| `yt-dlp` download fails | `[error] Download failed: <reason from stderr>` → exit 1 |
| `ffmpeg` not installed | `[error] ffmpeg is required for clip generation. Install it first.` → exit 1 |
| Invalid YouTube URL | `[error] Invalid YouTube URL: <url>` → exit 1 |
| No segments found above threshold | `[warn] No segments scored above threshold <n>. Try lowering --threshold.` → exit 0 with empty segments array |
| All LLM chunks failed | `[error] All chunks failed LLM analysis. Check your API key and model config.` → exit 1 |

---

## CLI Flags to Add

Update `src/index.ts` to accept:

| Flag | Type | Default | Description |
|---|---|---|---|
| `--clip` | boolean | false | Download video and generate clips |
| `--threshold <n>` | number | `SCORE_THRESHOLD` from config | Override minimum score |
| `--top-n <n>` | number | `TOP_N_SEGMENTS` from config | Override max segments |
| `--max-duration <s>` | number | none | Abort if video is longer than `s` seconds |
| `--output-json <path>` | string | none | Write output JSON to file instead of stdout |

Parse flags manually from `process.argv` or use a minimal arg parser (no heavy CLI framework).

---

## Progress Output

Add `[info]` log lines at each pipeline step so the user knows what's happening:

```
[info] Fetching metadata for dQw4w9WgXcQ...
[info] Video: "Never Gonna Give You Up" (3:33)
[info] Fetching transcript...
[info] Transcript: 312 lines → 91 micro-blocks → 16 chunks
[info] Analyzing chunks with gpt-4o (16 parallel calls)...
[info] Analysis complete: 4 segments above threshold 7
[info] Refining clip boundaries...
[info] Done.
```

---

## Output JSON

Ensure final stdout JSON matches `docs/plan.md §6` exactly:

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
    }
  ]
}
```

Print with `JSON.stringify(result, null, 2)`.

---

## Acceptance Criteria

- [ ] `npm run lint` passes with no type errors
- [ ] `npm test` still passes
- [ ] Every error scenario in the table above is handled (no unhandled exceptions)
- [ ] `--threshold`, `--top-n`, `--max-duration`, `--output-json` flags work correctly
- [ ] Progress logs appear at each step
- [ ] Output JSON matches spec exactly
- [ ] No `any` types anywhere in the codebase
- [ ] `npx tsx src/index.ts --help` prints usage (or at minimum a usage error with all flags listed)

---

## When Done

```
rm docs/phases/phase-5.md
```

All phases complete. The project is production-ready.
