# Advanced Usage

## CLI Examples

### Analyze only (no download)

```bash
vdclip https://youtube.com/watch?v=VIDEO_ID
```

### Download full video and generate clips

```bash
vdclip https://youtube.com/watch?v=VIDEO_ID --clip
```

### Download only the top N segments (faster)

```bash
# Download top 3 segments via yt-dlp --download-sections
vdclip https://youtube.com/watch?v=VIDEO_ID --download-sections 3
```

### Custom score threshold and segment count

```bash
vdclip https://youtube.com/watch?v=VIDEO_ID --threshold 8 --top-n 5
```

### Legacy server-side output directory

`--video-path` names a directory on the backend host. It is useful only when you control that
server; it cannot write to the computer running a remote CLI.

```bash
vdclip https://youtube.com/watch?v=VIDEO_ID --clip --video-path /srv/video-clipper/clips
```

### Write analysis JSON to a file instead of stdout

```bash
vdclip https://youtube.com/watch?v=VIDEO_ID --output-json analysis.json
```

### Test with a limited number of chunks (saves LLM cost)

```bash
vdclip https://youtube.com/watch?v=VIDEO_ID --max-chunks 3
```

### Configure media processing on a self-hosted backend

FFmpeg quality and timestamp variables belong to the backend process. Set them when starting the
backend, then run the CLI normally:

```bash
# Backend host
FFMPEG_PRESET=slow TIMESTAMP_OFFSET_SECONDS=-3 pnpm api:dev

# Client machine
vdclip https://youtube.com/watch?v=VIDEO_ID --clip --threshold 8
```

## Persistence and re-runs

There is no separate client-side cache. The backend stores video metadata, transcripts, per-chunk
LLM results, analyses, and clips in its library database. Re-running `run` or `analyze` on a video
reuses the stored transcript and any chunk results that already exist, so repeat runs are fast and
cheap. Browse what that backend stores with `vdclip library`.

To ignore stored chunk results and re-analyze every chunk (the transcript is still reused):

```bash
vdclip https://youtube.com/watch?v=VIDEO_ID --no-cache
```

On the backend, `CACHE_DIR` (`outputs/cache` by default) is used only by the publish flow to cache
LLM-generated publish metadata per clip.

## Legacy server-side pre-downloaded videos

`--local-video` refers to a file on the backend host. It can skip downloading when you self-host and
have already placed the video on that server. A hosted backend cannot read a path on the client
machine.

```bash
# Run analysis first to get segment timestamps
vdclip https://youtube.com/watch?v=VIDEO_ID --output-json analysis.json

# Cut clips from a file already present on the backend host
vdclip https://youtube.com/watch?v=VIDEO_ID --clip --local-video /srv/videos/video.mp4
```

### Use Cases

- **Self-hosted testing** — cut clips multiple times without re-downloading
- **Alternative server-side sources** — use a higher-quality file already present on the backend
- **Large files** — avoid downloading a file the backend already has

### Notes

- `--local-video` requires `--clip`
- `--download-sections` is ignored when `--local-video` is set
- The path must be accessible to the backend process
- The transcript is still fetched by the backend from YouTube or its cache

## Combining Pre-Downloaded Video with Timestamp Offset

If the video on your backend has a known sync offset, configure the backend before starting it:

```bash
TIMESTAMP_OFFSET_SECONDS=-3 pnpm api:dev
vdclip <url> --clip --local-video /srv/videos/video.mp4
```

See [audio-sync.md](audio-sync.md) for guidance on finding the right offset value.

## Using `npx` Without Installing

```bash
# Select the backend and run without a global installation
VIDEO_CLIPPER_API_URL=https://your-backend.example \
  npx vdclip analyze https://youtube.com/watch?v=VIDEO_ID
```

Provider keys and model configuration remain on the backend. The CLI does not read a local `.env`
file.

## yt-dlp Download Modes

See [yt-downloader.md](yt-downloader.md) for a detailed explanation of the backend's two yt-dlp
download strategies (`all` vs `--download-sections`) and when to use each.
