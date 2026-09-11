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

| Variable                   | Default | Description                                                                                                                                                                                     |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DOWNLOAD_SECTIONS_MODE`   | `all`   | `all` = full video download; `N` = download only top N segments via `--download-sections`                                                                                                       |
| `PARTIAL_DOWNLOAD_ENABLED` | `false` | Web UI only: download each segment individually instead of the full video; uses lossless remux (`-c:v copy -c:a copy`); incompatible with private/age-gated videos (must use `false` for those) |
| `FFMPEG_PATH`              | —       | Custom path to `ffmpeg` binary (optional)                                                                                                                                                       |
| `FFPROBE_PATH`             | —       | Custom path to `ffprobe` binary (optional)                                                                                                                                                      |
| `FFMPEG_PRESET`            | `fast`  | Encoding preset: `ultrafast`, `superfast`, `veryfast`, `fast`, `medium`, `slow`, `slower`                                                                                                       |
| `TIMESTAMP_OFFSET_SECONDS` | `0`     | Adjust all clip timestamps (positive = later, negative = earlier) — see [audio-sync.md](audio-sync.md)                                                                                          |
| `CLIP_CONCURRENCY`         | `1`     | Max parallel ffmpeg clip jobs                                                                                                                                                                   |

### Paths & Output

| Variable          | Default                                  | Description                                          |
| ----------------- | ---------------------------------------- | ---------------------------------------------------- |
| `DOWNLOAD_DIR`    | `downloads/`                             | Where to store downloaded videos                     |
| `OUTPUT_DIR`      | `outputs/`                               | Where to store generated clips, audio, and artifacts |
| `CACHE_DIR`       | `outputs/cache`                          | Publish metadata cache (LLM-generated titles etc.)   |
| `LIBRARY_DB_PATH` | `~/.config/video-clipper/library.sqlite` | Persistent SQLite database                           |

### YouTube / yt-dlp Authentication

| Variable                      | Default | Description                                                                                       |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `YT_DLP_COOKIES_FROM_BROWSER` | —       | Extract cookies from browser: `chrome`, `firefox`, `safari`, `brave`, `edge`, `opera`, `chromium` |
| `YT_DLP_COOKIES_FILE`         | —       | Path to a Netscape-format cookies file for yt-dlp authentication                                  |

### Sign-in OAuth

Without these, the app runs but nobody can get past `/login` — every page redirects there, and the
sign-in button reports that they are unset.

| Variable                              | Default | Description                                                                                      |
| ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `GOOGLE_OAUTH_CLIENT_ID`              | —       | Google OAuth client ID for customer sign-in                                                      |
| `GOOGLE_OAUTH_CLIENT_SECRET`          | —       | Google OAuth client secret for customer sign-in                                                  |
| `GOOGLE_OAUTH_REDIRECT_URI`           | —       | Redirect URI registered in Google Cloud, e.g. `http://localhost:5002/api/auth/google/callback`   |
| `SESSION_TTL_DAYS`                    | `30`    | How many days a sign-in stays valid                                                              |
| `INITIAL_ADMIN_EMAIL`                 | —       | Verified Google email eligible for bootstrap while no administrator exists                       |
| `CLI_LOGIN_RATE_LIMIT_REQUESTS`       | `10`    | CLI sign-in requests allowed per client, per endpoint, in one window                             |
| `CLI_LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `60`    | Per-client CLI sign-in rate-limit window                                                         |
| `CLI_LOGIN_MAX_OUTSTANDING`           | `1000`  | Combined in-memory cap on pending sign-ins and unredeemed grants                                 |
| `TRUSTED_PROXY_HOPS`                  | `0`     | Trusted hops from the right of `X-Forwarded-For`; `0` ignores caller-supplied forwarding headers |

The redirect URI points at the **frontend's** origin, not the backend's: the browser reaches the
backend through the frontend's `/api` proxy, so that is the address Google must send it back to. It
has to match the Cloud console entry byte for byte, port included. The CLI also uses its origin for
the page it asks you to open when you run `video-clipper login`.

### Roles

Every migrated or newly created account starts as a `customer`. Changing settings — from the web Settings page or
`video-clipper config <key> <value>` — needs the `settings:write` permission, which only the `admin`
role holds. Reading settings is open to any signed-in account.

For initial setup, set `INITIAL_ADMIN_EMAIL` to the Google email that should administer the app,
then sign in with that account. The email must be reported as verified by Google, and assignment
runs only while no administrator exists. The promotion is audit-logged. Remove the setting after
bootstrap; if every administrator is later demoted or removed, setting it again provides the
documented recovery path.

There is intentionally no self-service role mutation endpoint. Each row in `roles` contains its
own JSON `permissions` array. The single auth migration, `0011_rbac_and_cli_login`, upgrades the
pre-PR schema through migration `0010` directly to this structure and assigns existing customers
the `customer` role. It never creates `role_permissions` or `login_requests`. Invalid permission
data grants no access. `/api/me` returns the current role and permissions for both browser and CLI
sessions.

### Provider tokens at rest

Provider tokens use AES-256-GCM with the existing `enc:v1:` format. The backend requires
`TOKEN_ENCRYPTION_KEY` in its environment: the canonical base64 encoding of exactly 32 random
bytes. The normal `.env` bootstrap is supported; editable `config.json` settings are not a source
for this secret. The settings API neither returns it nor accepts changes to it.

The backend does not generate, read, write, or delete encryption-key files. For a new database,
generate a key once with `openssl rand -base64 32`, then provision it through the deployment
environment or secret manager. A missing or malformed key stops startup before the database is
opened. A key that cannot decrypt existing records stops startup before token migration or serving
requests. Plaintext records from older versions are encrypted after validation succeeds.

#### Upgrading an existing installation

1. Stop the backend and back up the database, including any uncheckpointed SQLite WAL, and its
   matching encryption key. Keep the secret backup securely alongside the database backup.
2. Set `TOKEN_ENCRYPTION_KEY` to the **existing key file's base64 value**. Find that file at the
   previously configured `TOKEN_ENCRYPTION_KEY_PATH`, beside the database as `auth-token.key`, or
   in the user configuration directory for older installations. Do not generate a replacement.
3. Upgrade backend and CLI together. Migration `0011` adds roles with their permissions stored
   directly as JSON; existing customers, identities and sessions are preserved. Existing CLI
   credentials remain compatible, but unfinished code-based login attempts must be restarted
   with the updated CLI.
4. Start the backend and verify sign-in. Existing key files are left untouched; retire them only
   according to your backup policy after verifying the provisioned secret and backup.

PR #37 is unreleased, so its intermediate `0011`/`0012` migrations have been consolidated into
one migration. A development database that already applied either intermediate version cannot
use the normal upgrade path above. Back up that database and its matching secret before an
explicit, reviewed reconciliation of its schema and migration history, preserving any custom
roles and grants. Alternatively, point `LIBRARY_DB_PATH` at a separate, new development database
and retain the old database and secret. Do not reset, delete or silently rewrite an existing
database or its migration history.

To restore a database, restore the exact matching environment secret too. If the key is permanently
lost, first back up the database, deliberately clear `access_token` and `refresh_token` in
`auth_identities`, and provision a new key; affected customers must consent again. Changing the
environment secret alone is not a supported key-rotation procedure.

### CLI sign-in

`video-clipper login` opens your system browser for Google sign-in. The browser and CLI must run
on the same machine: after sign-in, the backend redirects to a temporary listener on
`127.0.0.1` and the CLI exchanges a one-use grant for its own session. No code needs to be typed
or compared. If opening the browser fails, open the printed URL in a browser on that machine.
The existing Google OAuth redirect URI stays unchanged; Google returns to the backend first.

The CLI stores its session in `~/.config/video-clipper/credentials.json`, readable only by you
(on Windows the file relies on your profile's permissions). Credentials are keyed by backend
origin; set `VIDEO_CLIPPER_API_URL` before signing in to a different backend. `whoami` shows the
account and role. CLI logout revokes only the CLI session, leaving the browser signed in.
If the backend is offline, logout exits non-zero and retains the minimum revocation data in the
same owner-only file. A later login or logout retries it.

Pending sign-ins expire after ten minutes, and completed grants must be exchanged within sixty
seconds. They live in bounded memory in one backend process, so a restart requires starting login
again. Shared-IP clients have independent requests. Browserless SSH sign-in and multiple backend
workers without shared handshake storage are not supported by this flow. Cancel with Ctrl-C to
close the local listener. The retired approval and polling endpoints return an upgrade instruction.

Which scopes this asks for, and why publishing asks separately, is in
[google-oauth-scopes.md](./google-oauth-scopes.md).

### YouTube Upload OAuth

A separate client from sign-in above, because publishing needs the upload scope and sign-in
deliberately does not ask for it.

| Variable                      | Default | Description                                                                                                 |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `YOUTUBE_OAUTH_CLIENT_ID`     | —       | Google OAuth client ID for YouTube uploads                                                                  |
| `YOUTUBE_OAUTH_CLIENT_SECRET` | —       | Google OAuth client secret for YouTube uploads                                                              |
| `YOUTUBE_OAUTH_REDIRECT_URI`  | —       | Redirect URI registered in Google Cloud, e.g. `http://localhost:5002/api/youtube/connection/oauth/callback` |

These are app-level defaults. The web Settings page can override them, but if you leave those
fields empty the app falls back to the values from `.env` automatically.

Publishing connects over OAuth only. Pasting a token by hand was a prototype workaround and the
route is gone; if the fields above are unset, the Connect button says so instead of offering one.

> `YT_DLP_COOKIES_FROM_BROWSER` and `YT_DLP_COOKIES_FILE` are mutually exclusive.

#### Specifying a Chrome profile

Bare `chrome` reads the **Default** profile. If your YouTube session lives in a different profile, append `:Profile Name`:

```env
YT_DLP_COOKIES_FROM_BROWSER=chrome:Profile 1
```

To find which profile has a valid YouTube session, check the cookie count per profile:

```bash
for profile in "Default" "Profile 1" "Profile 2"; do
  db="$HOME/Library/Application Support/Google/Chrome/$profile/Cookies"
  [ -f "$db" ] || continue
  count=$(python3 -c "
import sqlite3, shutil, tempfile, os
tmp = tempfile.mktemp(suffix='.db')
shutil.copy2('$db', tmp)
c = sqlite3.connect(tmp)
print(c.execute(\"SELECT COUNT(*) FROM cookies WHERE host_key LIKE '%youtube%'\").fetchone()[0])
c.close(); os.unlink(tmp)
" 2>/dev/null)
  echo "$profile: $count YouTube cookies"
done
```

Use the profile with the highest count, e.g. `chrome:Profile 1`.

#### Cookie rotation

Chrome rotates YouTube session cookies frequently as a security measure. If you see:

```
WARNING: The provided YouTube account cookies are no longer valid.
```

Re-authenticate: open Chrome, sign in to YouTube in a fresh private/incognito window, then retry. yt-dlp will re-extract the fresh cookies automatically on the next run.

Alternatively, export a static `cookies.txt` file and use `YT_DLP_COOKIES_FILE` — this is more stable than `--cookies-from-browser` for automation.

## Reading config in code: flat or grouped

The environment is flat, and that stays the operator's contract — the names in the tables above are
what you put in `.env`, and what `PATCH /api/settings` takes. How the code reads them is a separate
choice, and both shapes are available.

```ts
import { getConfig, getGroupedConfig, groupConfig } from '@lib/config/index.js';

getConfig().GOOGLE_OAUTH_CLIENT_ID; // flat — the env name, one key
getGroupedConfig().GOOGLE.OAUTH_CLIENT_ID; // grouped — the whole Google set in one object
groupConfig(cfg).YT_DLP; // every yt-dlp option, ready to pass on
```

Grouping earns its keep where a caller wants a whole set rather than one value — the OAuth clients in
`api/services/appConfig.ts`, or the ten `YT_DLP_*` options. For a single value the flat read is
shorter and just as clear.

Groups are **derived**, never declared twice. `ConfigGroup<'GOOGLE'>` is computed from `Config` by
stripping the prefix, so adding `GOOGLE_ANYTHING` to the schema makes `GOOGLE.ANYTHING` appear with
nothing else to update, and renaming a key cannot leave a stale group entry behind. The prefixes that
become groups are `CONFIG_GROUP_PREFIXES` in `types/config.ts`; longest match wins, so `YT_DLP_QUIET`
lands in `YT_DLP` rather than a shorter `YT` group. A key matching no prefix — `SCORE_THRESHOLD`,
`OUTPUT_DIR` — stays on flat `Config` only.

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

See [docs/guides/free-models.md](free-models.md) for a curated list of free models that work well with this tool.

## Custom OpenAI-Compatible Endpoint

```env
LLM_PROVIDER=custom
CUSTOM_OPENAI_API_KEY=your_key
CUSTOM_OPENAI_BASE_URL=https://your-endpoint.example.com/v1
LLM_MODEL=your-model-id
```
