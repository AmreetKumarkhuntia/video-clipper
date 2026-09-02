# Advanced Usage

## CLI Examples

### Analyze only (no download)

```bash
video-clipper https://youtube.com/watch?v=VIDEO_ID
```

### Download full video and generate clips

```bash
video-clipper https://youtube.com/watch?v=VIDEO_ID --clip
```

### Download only the top N segments (faster)

```bash
# Download top 3 segments via yt-dlp --download-sections
video-clipper https://youtube.com/watch?v=VIDEO_ID --download-sections 3
```

### Custom score threshold and segment count

```bash
video-clipper https://youtube.com/watch?v=VIDEO_ID --threshold 8 --top-n 5
```

### Custom output directory

```bash
video-clipper https://youtube.com/watch?v=VIDEO_ID --clip --video-path ./my-clips
```

### Write analysis JSON to a file instead of stdout

```bash
video-clipper https://youtube.com/watch?v=VIDEO_ID --output-json analysis.json
```

### Test with a limited number of chunks (saves LLM cost)

```bash
video-clipper https://youtube.com/watch?v=VIDEO_ID --max-chunks 3
```

### Combine env overrides with flags

```bash
# High quality clips, custom threshold, timestamp offset
FFMPEG_PRESET=slow TIMESTAMP_OFFSET_SECONDS=-3 \
  video-clipper https://youtube.com/watch?v=VIDEO_ID --clip --threshold 8
```

## Persistence and re-runs

There is no separate file cache. Everything the CLI produces — video metadata, transcripts, per-chunk LLM results, analyses, and clips — is stored in the local SQLite library database that the web app shares. Re-running `run` or `analyze` on a video reuses the stored transcript and any chunk results that already exist, so repeat runs are fast and cheap. Browse what is stored with `video-clipper library`.

To ignore stored chunk results and re-analyze every chunk (the transcript is still reused):

```bash
video-clipper https://youtube.com/watch?v=VIDEO_ID --no-cache
```

`CACHE_DIR` (`outputs/cache` by default) is now used only by the publish flow, to cache LLM-generated publish metadata per clip.

## Working with Pre-Downloaded Videos

If you already have a local copy of the video (from yt-dlp, a browser, or another tool), you can skip the download step entirely using `--local-video`.

```bash
# Run analysis first to get segment timestamps
video-clipper https://youtube.com/watch?v=VIDEO_ID --output-json analysis.json

# Cut clips from your local video file (no download)
video-clipper https://youtube.com/watch?v=VIDEO_ID --clip --local-video /path/to/video.mp4
```

### Use Cases

- **Testing different settings** — cut clips multiple times without re-downloading
- **Manual timestamp adjustment** — edit `analysis.json`, then re-cut
- **Alternative video sources** — use a higher-quality version from another source
- **Large files** — avoid re-downloading files you already have

### Notes

- `--local-video` requires `--clip`
- `--download-sections` is ignored when `--local-video` is set
- The transcript is still fetched from YouTube (or cache) — only the video download is skipped

## Combining Pre-Downloaded Video with Timestamp Offset

If your local video has a known sync offset:

```bash
TIMESTAMP_OFFSET_SECONDS=-3 video-clipper <url> --clip --local-video /path/to/video.mp4
```

See [audio-sync.md](audio-sync.md) for guidance on finding the right offset value.

## Using `npx` Without Installing

```bash
# Set env vars inline and run with npx
OPENAI_API_KEY=sk-... LLM_PROVIDER=openai \
  npx @thunderkiller/video-clipper https://youtube.com/watch?v=VIDEO_ID
```

Or put your vars in a `.env` file in the working directory — `dotenv` picks it up automatically.

## yt-dlp Download Modes

See [yt-downloader.md](yt-downloader.md) for a detailed explanation of the two yt-dlp download strategies (`all` vs `--download-sections`) and when to use each.
