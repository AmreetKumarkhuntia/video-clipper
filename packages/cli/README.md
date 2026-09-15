# video-clipper CLI

Sign in to your video-clipper backend, analyze YouTube videos, and manage saved clip candidates from the terminal.

## Install and connect

Requires Node.js 22 or later and a running video-clipper backend. Analysis, source downloads, and clip rendering run on the backend. The CLI installation does not require Python, ffmpeg, yt-dlp, a database, or provider API keys.

```sh
npm install --global @thunderkiller/video-clipper
export VIDEO_CLIPPER_API_URL=https://your-video-clipper-host.example
video-clipper login
video-clipper whoami
video-clipper analyze https://www.youtube.com/watch?v=VIDEO_ID
video-clipper library
video-clipper candidates ANALYSIS_ID
video-clipper clip ANALYSIS_ID
video-clipper logout
```

Replace the example origin with your backend's origin. `VIDEO_CLIPPER_API_URL` defaults to `http://localhost:5051` for the existing local development setup. In PowerShell, set it with `$env:VIDEO_CLIPPER_API_URL = 'https://your-host.example'`.

Login opens the system browser on the same machine and exchanges a one-time code for a backend session. Credentials are stored per origin in `~/.config/video-clipper/credentials.json`. Logout revokes the session; if the backend is unavailable, rerun logout to complete the pending revocation.

Run `video-clipper --help`, `video-clipper <command> --help`, or `video-clipper --version` without a backend connection. `config` reads backend configuration; changes require an administrator account.

## Current remote-file behavior

Generated clips are stored on the server and can be viewed through the web app. Paths returned by the current backend belong to that server. The legacy `--local-video` and `--video-path` flags also describe server paths; they cannot access files on your client machine. Dedicated remote download commands are tracked in the distribution plan and are not included in this packaging change. `--output-json` writes a response to the client's disk.

## Migrating from the combined package

This package now provides only the `video-clipper` executable. It no longer exports the domain library or includes the backend, migrations, or media scripts. Applications that imported the old library must migrate to the backend HTTP API. Self-hosting instructions and source remain in the [project repository](https://github.com/AmreetKumarkhuntia/video-clipper).
