# yt-dlp Download Modes

This CLI supports two download strategies for generating video clips.

---

## Mode 1: Full Video Download (Default)

Downloads entire video first, then uses `ffmpeg` to cut individual clips.

**When to use:**

- Generating many clips from one video
- Want flexibility to cut different clips later
- Internet connection is fast/stable

**Trade-offs:**
| Aspect | Full Download |
|--------|--------------|
| Speed | Slower initial download |
| Bandwidth | Higher |
| Disk Usage | Higher |
| Flexibility | Can cut different clips later |

**Command:**

```bash
# Default behavior (when using --clip)
npm run start -- <url> --clip

# Explicit flag
npm run start -- <url> --clip --download-sections all
```

---

## Mode 2: Segments Download

Downloads only top N segments using yt-dlp's `--download-sections` feature.

**When to use:**

- Generating only a few clips (1-5)
- Want to save bandwidth
- Video is very long but only need short clips

**Trade-offs:**
| Aspect | Segments Download |
|--------|-------------------|
| Speed | Faster for few clips |
| Bandwidth | Lower (only needed portions) |
| Disk Usage | Lower |
| Flexibility | Clips are final |

**Command:**

```bash
# Download top 3 segments
npm run start -- <url> --download-sections 3

# Download top 5 segments to custom directory
npm run start -- <url> --download-sections 5 --video-path ./my-clips
```

**Note:** Using `--download-sections N` implicitly enables `--clip` mode.

---

## Custom Output Path

Override default download/clip directories with `--video-path`:

```bash
# Full video to custom path
npm run start -- <url> --clip --video-path ./downloads

# Segments to custom path
npm run start -- <url> --download-sections 3 --video-path ./my-clips
```

This flag overrides:

- `DOWNLOAD_DIR` for full video downloads
- `OUTPUT_DIR` for segment downloads and clip organization

---

## Working with Pre-Downloaded Videos

If you already have a video downloaded (from yt-dlp, browser download, or other tool), you can skip the download step and work directly with that file.

**Workflow:**

```bash
# Step 1: Run analysis once to get segment timestamps
npm run start -- <url> --output-json analysis.json

# Step 2: (Optional) Edit timestamps in analysis.json if needed
# Edit the "start" and "end" values for each segment

# Step 3: Place your video in downloads/ directory
cp /path/to/your/video.mp4 downloads/<videoId>.mp4

# Step 4: Run again - will skip download and use your video
npm run start -- <url> --clip
```

**Use cases:**

- **Testing different settings** - Run different clip configurations without re-downloading
- **Manual timestamp adjustment** - Fine-tune segment boundaries based on visual inspection
- **Alternative video sources** - Work with videos downloaded from other tools or browsers
- **Large video files** - If you have a high-quality version, use that instead

**Notes:**

- The video file must be named exactly `{videoId}.mp4` in the `DOWNLOAD_DIR`
- You can apply `TIMESTAMP_OFFSET_SECONDS` globally instead of editing each timestamp
- Transcript cache is used, so re-running is fast (no API calls)

### Combining with Timestamp Offset

For pre-downloaded videos with known sync issues:

```bash
# Skip download, apply 3-second offset to all clips
TIMESTAMP_OFFSET_SECONDS=-3 npm run start -- <url> --clip
```

The CLI will find the existing video in `downloads/`, skip the download step, and apply the offset to all clip generation.

---

## How It Works

### Full Download Mode

1. Download entire video: `yt-dlp <url>`
2. Cut clips with ffmpeg: `ffmpeg -i video.mp4 -ss <start> -to <end> -c:v libx264 -preset fast -c:a aac clip.mp4`
3. Re-encodes with libx264 (video) and aac (audio) for perfect audio/video sync

### Segments Download Mode

1. For top N segments: `yt-dlp --download-sections "*{start}-{end}" <url>`
2. Downloads are parallel (concurrency controlled by `LLM_CONCURRENCY`)
3. No ffmpeg cutting needed — segments are pre-cut by yt-dlp
4. yt-dlp's `--download-sections` ensures proper audio/video sync
5. Only top N segments (by score) are downloaded

**Note:** The full download mode re-encodes clips to ensure audio/video synchronization, which is slower but produces accurate results. The segments download mode relies on yt-dlp's built-in cutting which also maintains proper sync.

### Millisecond Precision

The `--download-sections` mode now uses millisecond precision (HH:MM:SS.mmm format) instead of just HH:MM:SS. This ensures accurate segment downloads, especially important for short clips.

**Before:**

```
*00:02:00-00:02:30  # Lost decimal part (120.5s became 120s)
```

**After:**

```
*00:02:00.500-00:02:30.000  # Preserves exact timestamp (120.5s kept as 120.500s)
```

### Timestamp Offset

The `TIMESTAMP_OFFSET_SECONDS` config option applies a global adjustment to all timestamps in both modes:

- **Positive value** = Shift clips later in time
- **Negative value** = Shift clips earlier in time
- **Default** = 0 (no adjustment)

This is useful when transcript timestamps don't perfectly match the actual video timing.

---

## Troubleshooting: Timestamp Alignment

### Problem: Audio is delayed or starts early

**Symptoms:**

- Video starts at correct moment but audio plays 2-5 seconds later/earlier
- Lip movements don't match speech in the clip
- Content in clip doesn't match the transcript segment

**Root Causes:**

1. **Transcript misalignment** - Transcript timestamps don't perfectly match the video
   - **Auto-generated captions**: Often have 1-3 second delays
   - **Manual captions**: Usually more accurate but can have timing issues
   - **Multiple caption tracks**: Transcripts from different video versions

2. **Millisecond precision loss** - Old implementation lost decimal seconds
   - **Fixed**: Now using HH:MM:SS.mmm format for `--download-sections`

3. **Version differences** - The transcript might be from a slightly different version of the video

### Solution: Use `TIMESTAMP_OFFSET_SECONDS`

**What it does:**
Applies a global offset to all clip timestamps. Positive = shift later, negative = shift earlier.

**How to use:**

```bash
# Add to .env
TIMESTAMP_OFFSET_SECONDS=-3

# Or inline
TIMESTAMP_OFFSET_SECONDS=-3 npm run start -- <url> --clip
```

### Finding the Correct Offset

**Step 1: Test with logging**

Run a single segment and observe the logs:

```bash
TIMESTAMP_OFFSET_SECONDS=0 npm run start -- <url> --download-sections 1
```

Look for these log lines:

```
[info] Downloading segment 1: 00:02:00.500-00:02:30.000 (strong opinion...)
[info]   Requested: 120.50s - 150.00s
[info]   Adjusted: 117.50s - 147.00s (offset: -3s)
[info] Cutting clip: start=117.50s, end=147.00s, duration=29.50s
```

**Step 2: Play and verify**

- Open the generated clip
- Check if the moment matches the transcript description
- Note if it's too early or too late

**Step 3: Adjust offset**

If clip **starts 3 seconds late**:

```bash
TIMESTAMP_OFFSET_SECONDS=-3  # Negative = shift earlier
```

If clip **starts 2 seconds early**:

```bash
TIMESTAMP_OFFSET_SECONDS=2   # Positive = shift later
```

**Step 4: Verify with multiple clips**

```bash
TIMESTAMP_OFFSET_SECONDS=-3 npm run start -- <url> --download-sections 3
```

Check if the offset works consistently across different segments.

### Binary Search for Optimal Offset

If you're unsure of the exact offset:

```bash
# Try 0, -3, -6, -9 to see which is closest
for offset in 0 -3 -6 -9; do
  TIMESTAMP_OFFSET_SECONDS=$offset npm run start -- <url> --download-sections 1
  echo "Tested offset: $offset"
  # Play and check accuracy
done
```

Then narrow down: `-3` seems good, try `-2` and `-4`, etc.

### Common Scenarios

| Scenario                | Likely Offset | Explanation                                         |
| ----------------------- | ------------- | --------------------------------------------------- |
| Auto-generated captions | `-1` to `-3`  | ASR timing often lags behind actual speech          |
| Manual captions         | `0` to `-1`   | Usually more accurate, small sync issues            |
| Multiple caption tracks | `-2` to `-5`  | Different versions may have systematic offset       |
| Regional variations     | Varies        | Different regions may have different caption timing |

### Verifying the Fix

After applying `TIMESTAMP_OFFSET_SECONDS`, verify:

1. **Watch the clip**: Audio and video should be synchronized
2. **Check multiple clips**: Offset should work consistently
3. **Compare with original**: Clip should match the described content

If offset varies between segments, the issue might be video-specific rather than a global transcript offset.

---

## Progress Display

Both modes show real-time yt-dlp progress:

```
[download] 45.2% of 125MiB at 2.5MiB/s ETA 00:32
```

Progress updates inline (same line) to keep logs clean.

---

## ⚠️ Requirements

Both modes require:

1. **yt-dlp** — Install from https://github.com/yt-dlp/yt-dlp
2. **ffmpeg** — Required for full download mode

```bash
# macOS
brew install yt-dlp ffmpeg

# Ubuntu/Debian
sudo apt-get install yt-dlp ffmpeg

# Windows
# Install from GitHub releases or use winget
```

---

## Examples

### Download full video and cut clips

```bash
npm run start -- https://youtube.com/watch?v=abc123 --clip
```

### Download top 3 segments only

```bash
npm run start -- https://youtube.com/watch?v=abc123 --download-sections 3
```

### Download top 5 segments to custom directory

```bash
npm run start -- https://youtube.com/watch?v=abc123 --download-sections 5 --video-path ./my-clips
```

### Download segments with timestamp offset

```bash
# Fix 3-second audio delay
TIMESTAMP_OFFSET_SECONDS=-3 npm run start -- <url> --download-sections 3

# Custom quality preset with offset
FFMPEG_PRESET=medium TIMESTAMP_OFFSET_SECONDS=-3 npm run start -- <url> --download-sections 5
```

### Full video to custom directory

```bash
npm run start -- https://youtube.com/watch?v=abc123 --clip --video-path ./downloads
```

### Set default mode via environment

```bash
# Add to .env
DOWNLOAD_SECTIONS_MODE=all

# Or inline
DOWNLOAD_SECTIONS_MODE=all npm run start -- <url> --clip
```

### Pre-downloaded video workflow

```bash
# Step 1: Download your video manually (any method)
cp /path/to/video.mp4 downloads/abc123.mp4

# Step 2: Run analysis (will skip download)
npm run start -- https://youtube.com/watch?v=abc123 --clip

# Add offset if needed
TIMESTAMP_OFFSET_SECONDS=-2 npm run start -- https://youtube.com/watch?v=abc123 --clip
```

---

## Backward Compatibility Note

The old `--download-sections segments` flag is deprecated but still works (shows a warning). It now behaves the same as `--download-sections all` (downloads full video).

```bash
# Old style (deprecated, still works)
npm run start -- <url> --clip --download-sections segments

# New recommended style
npm run start -- <url> --clip --download-sections all
```

---

## Configuration Options

### FFMPEG_PRESET

Controls encoding speed/quality trade-off for clip generation in full download mode:

| Preset           | Speed     | Quality | Use Case               |
| ---------------- | --------- | ------- | ---------------------- |
| `ultrafast`      | Very fast | Lowest  | Quick testing          |
| `fast` (default) | Fast      | Good    | Balanced performance   |
| `medium`         | Medium    | Better  | Higher quality clips   |
| `slow`           | Slow      | High    | Final production clips |

```bash
# Set in .env
FFMPEG_PRESET=medium

# Or inline
FFMPEG_PRESET=slow npm run start -- <url> --clip
```

### TIMESTAMP_OFFSET_SECONDS

Global timestamp adjustment in seconds. Negative = earlier, Positive = later.

```bash
# Set in .env
TIMESTAMP_OFFSET_SECONDS=-3

# Or inline
TIMESTAMP_OFFSET_SECONDS=2 npm run start -- <url> --clip
```

Use this to fix systematic audio/video desynchronization when transcript timestamps don't match the video.
