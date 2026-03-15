# Phase 4 — Video Download + Clip Generation

## Goal

Implement video downloading via `yt-dlp` and clip cutting via `fluent-ffmpeg`, gated behind
a `--clip` flag so the pipeline only downloads video when the user explicitly requests it.

## Deliverable

```
npx tsx src/index.ts https://youtube.com/watch?v=<id> --clip
```

Downloads the video to `downloads/<id>.mp4` and cuts each ranked segment into
`outputs/<id>_<start>_<end>.mp4`.

---

## Files to Create

### `src/services/videoDownloader/`

**`index.ts`**
- `downloadVideo(videoId: string): Promise<string>` — returns the local file path
- Uses `yt-dlp` via `execa`:
  ```
  yt-dlp -f bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]
         -o downloads/<videoId>.%(ext)s
         https://youtube.com/watch?v=<videoId>
  ```
- Skips download if file already exists (check before running `yt-dlp`)
- Returns resolved path: `<config.DOWNLOAD_DIR><videoId>.mp4`
- Throws with reason on failure (private, geo-blocked, etc.) — parse `yt-dlp` stderr

---

### `src/services/clipGenerator/`

**`index.ts`**
- `generateClips(videoPath: string, segments: RankedSegment[], videoId: string): Promise<string[]>`
  - Returns array of output file paths
- Uses `fluent-ffmpeg`:
  - `setStartTime(segment.start)`
  - `setDuration(segment.end - segment.start)`
  - `outputOptions('-c copy')` — no re-encoding for speed
  - Output: `<config.OUTPUT_DIR><videoId>_<start>_<end>.mp4`
- Wraps each clip in a `Promise` — uses `Promise.allSettled` so one failure doesn't abort rest
- On failure: log `[warn] clip <start>-<end> failed: <reason>`, skip

---

### `src/index.ts` (add `--clip` flag)

- Check `process.argv` for `--clip` flag
- If present, after ranking and refining:
  ```
  downloadVideo(videoId)    → videoPath
  generateClips(videoPath, refined, videoId) → clipPaths
  ```
- Log each clip path on success
- If `--clip` is absent, skip download entirely (print note to user)

---

## Acceptance Criteria

- [ ] `npm run lint` passes with no type errors
- [ ] Without `--clip`: pipeline runs, no download occurs, JSON is printed
- [ ] With `--clip`: video is downloaded to `downloads/`, clips appear in `outputs/`
- [ ] Already-downloaded video is not re-downloaded (idempotent)
- [ ] One clip failure does not abort remaining clips
- [ ] Clear error if `yt-dlp` is not installed
- [ ] Clear error if `ffmpeg` is not installed
- [ ] No `any` types in any new file

---

## When Done

```
rm docs/phases/phase-4.md
```

Move to `docs/phases/phase-5.md`.
