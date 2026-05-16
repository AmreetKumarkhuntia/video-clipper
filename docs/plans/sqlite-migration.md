# SQLite Migration — Persistence Refactor

Move every persistent entity from JSON files / filesystem cache to a single SQLite database accessed via Drizzle ORM. Refactor is per-endpoint, driven by the `/migrate-endpoint-to-sqlite` skill.

## Why

Persistent state today is scattered across `outputs/web/*.json` (analyses, clips, edits, drafts, uploads), `outputs/cache/*` (transcripts, chunk evals, segment refinements, audio events), and `~/.config/video-clipper/*.json` (config, youtube-auth). The result:

- No joins, no FK integrity, no transactional writes.
- "List all videos in channel X that have at least one rendered clip" requires scanning directories.
- The cache layer is a parallel persistence with its own lifecycle, which means re-running analysis after a cache eviction re-spends LLM cost for no product reason.
- IDs are baked into filenames, so renaming/relationships are awkward.

A relational schema lets the data model (channels → videos → transcripts → analyses → chunks → candidates → clips → edits → publish → uploads) drive the product, makes "don't re-analyze" a `SELECT`, and removes the cache-vs-store split.

## Decisions

1. **DB:** SQLite via Drizzle ORM. Local-first, single file, typed schema, zero infra.
2. **Cutover:** full refactor, no JSON fallback, no dual-write, no backfill of existing user data. Each endpoint is cut over and the JSON code paths for it are deleted in the same change.
3. **Scope:** everything persistent moves to SQLite, including transcripts and chunk evaluations. The DB row _is_ the cache — no separate cache backend.
4. **Vehicle:** a recipe skill (`.claude/skills/migrate-endpoint-to-sqlite.md`, invoked as `/migrate-endpoint-to-sqlite`) — checklist, not codegen.

## Architecture

### Layout

```
src/lib/services/db/
  client.ts          singleton better-sqlite3 + drizzle wrapper
  schema.ts          drizzle table definitions
  migrate.ts         runs migrations on first import
  repos/
    channelsRepo.ts
    videosRepo.ts
    transcriptsRepo.ts
    analysesRepo.ts
    chunkEvaluationsRepo.ts
    clipCandidatesRepo.ts
    clipArtifactsRepo.ts
    clipEditsRepo.ts
    publishDraftsRepo.ts
    publishDraftItemsRepo.ts
    uploadArtifactsRepo.ts
    audioEventsRepo.ts
    youtubeAuthRepo.ts
    userConfigRepo.ts
drizzle/             generated migrations
```

- DB file: `~/.config/video-clipper/library.sqlite` (override with `LIBRARY_DB_PATH`).
- Web service layer in `src/app/web/lib/services/` imports from `src/lib/services/db/repos/*` instead of touching the filesystem.
- Domain types (`ClipPlan`, `ClipArtifact`, `ClipEdits`, `TranscriptBundle`, `PublishDraft`, …) stay in `src/lib/types/` / `src/app/web/types/`. Drizzle's inferred row types are re-exported from `src/lib/types/db.ts`. Repos translate row ↔ domain.
- Zod parsing stays at the repo boundary for JSON columns (parse on read and write).

### Schema (tables and key relationships)

```
channels (id PK)
  ↓ 1:N
videos (id PK, channel_id FK, local_path, download_status, ...)
  ↓ 1:1
transcripts (video_id PK FK, lines JSON, micro_blocks JSON, llm_chunks JSON, source)
  ↓ 1:N
analyses (id PK, video_id FK, options JSON, status, ...)
  ↓ 1:N                          ↓ 1:N
clip_candidates                  chunk_evaluations
  (analysis_id FK, rank,           (analysis_id FK, chunk_index,
   start, end, score, reason,       chunk_hash UNIQUE, evaluation JSON)
   source, audio_event,
   transcript_excerpt, selected)
       ↓ 1:0..1
clip_artifacts (id PK, video_id FK, analysis_id FK, candidate_id FK,
                path, edited_path, current_edits_hash, last_rendered_hash)
  ↓ 1:1
clip_edits (clip_id PK FK, edits JSON, current_hash)

publish_drafts (id PK, analysis_id FK UNIQUE, video_id FK)
  ↓ 1:N
publish_draft_items (id PK, draft_id FK, clip_artifact_id FK,
                     title, description, tags JSON, thumbnail_path,
                     generated_metadata JSON, order_index)

upload_artifacts (id PK, analysis_id FK, clip_artifact_id FK, video_id FK,
                  youtube_video_id, status, error, metadata JSON)

audio_events (id PK, video_id FK, window_start, window_end, events JSON)
youtube_auth (singleton row, id=1)
user_config (key PK, value JSON)
```

- JSON columns for shape-heavy, non-queried payloads (transcript lines, edits, generated metadata).
- Real columns for anything we filter or join on (`video_id`, `analysis_id`, `chunk_hash`, `status`, `selected`, …).
- `created_at` / `updated_at` (INTEGER unix ms) on every table.

## Migration order

Each step migrates a small set of endpoints + the tables they touch. After each step: dev server runs, the flow works end-to-end against the new DB, old JSON code paths are deleted.

1. **Foundation (no endpoints)** — add `better-sqlite3`, `drizzle-orm`, `drizzle-kit`; write `client.ts`, `schema.ts`, initial migration, `migrate.ts`. Wire migration into `src/app/web/hooks.server.ts`.
2. **YouTube auth** — `GET/POST /api/youtube/auth/{status,start,callback,manual,disconnect}` → `youtube_auth`; replace `authStore.ts`.
3. **User config** — `GET/POST /api/config` → `user_config`; replace `fileStore.ts`. Registry stays as code.
4. **Channels + Videos** — `GET /api/youtube/channels/resolve`, `GET /api/youtube/channels/[channelId]/videos`, `GET /api/youtube/videos/[videoId]` → upsert into `channels` / `videos` on first view.
5. **Transcripts** — `GET /api/youtube/videos/[videoId]/transcript`, `DELETE /api/cache/videos/[videoId]/transcript` → `transcripts`.
6. **Analyses + chunks + candidates** — `POST /api/analysis/transcript`, `GET /api/library/analyses`, `GET /api/library/analyses/[analysisId]`, `DELETE /api/cache/videos/[videoId]/analysis` → `analyses` + `chunk_evaluations` + `clip_candidates`. Chunk reuse becomes `SELECT … WHERE chunk_hash = ?`.
7. **Clips + edits** — `POST /api/clips`, `GET/PUT /api/clips/[clipId]/edits`, `POST /api/clips/[clipId]/render`, `GET /api/clips/[clipId]/file`, `GET /api/library/clips`, `POST /api/clips/[clipId]/subtitles/plan` → `clip_artifacts` + `clip_edits`. mp4s stay on disk.
8. **Publish drafts** — `GET/POST /api/publish/drafts`, `GET /api/publish/drafts/[analysisId]`, `POST /api/publish/drafts/generate`, `POST /api/publish/thumbnails` → `publish_drafts` + `publish_draft_items`.
9. **Uploads** — `POST /api/youtube/uploads` → `upload_artifacts`.
10. **Audio events + cache teardown** — promote audio events to `audio_events`; delete `src/lib/services/cache/` entirely; drop `CACHE_BACKEND` env.
11. **Cleanup** — remove `outputs/web/` and `outputs/cache/` write paths from code. Keep `outputs/clips/`, `outputs/thumbnails/`, `downloads/` (filesystem assets).

## Out of scope

- Backfilling existing `outputs/web/*.json` into SQLite.
- Multi-user / multi-tenant; the DB is single-user local.
- Hosted Postgres variant (schema is portable later).
- Performance tuning beyond obvious FK + `chunk_hash` indexes.

## Verification per step

- `pnpm dev` boots without error.
- UI flow for the migrated endpoint works end-to-end against a fresh DB.
- `pnpm typecheck` clean.
- `sqlite3 ~/.config/video-clipper/library.sqlite '.tables'` and a sample `SELECT` show the expected rows.
- `grep` confirms the deleted JSON path is gone from code.

## After final step

- `outputs/web/` and `outputs/cache/` directories are unused by code.
- `src/lib/services/cache/` is deleted.
- Re-running analysis on the same video reuses chunk evaluations via `chunk_hash` — no LLM re-call.
