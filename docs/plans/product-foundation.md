# Product Foundation — customers, channel link, jobs

> **Status: PARTIAL** — decided 2026-09-02; D1, D4, D5, D6 confirmed with the user, and D5 verified against the YouTube Data API reference (no media download endpoint; `captions.download` is owner-only, `youtube.force-ssl`, 200 quota units).
>
> Phase 1's data model shipped in `8c9a5c6` — `customers`, `auth_identities`, `sessions`, `library_videos`, their repos, and `authOrchestrator`. It landed with a correction to what is written below: **identity tables never name a provider**, so sign-in lives in `auth_identities`, not a column on `customers`. The routes and pages on top of it are tracked in [product-restructure.md](./product-restructure.md); Phases 0, 2, 3, 4 and 5 are untouched.

## Context (why)

The library is now a set of independently importable services with a thin CLI and web app on top
([services-refactor.md](./archive/services-refactor.md)). The next step is a product: a **customer** signs up,
is linked **1:1 to one YouTube channel**, and the system fetches that channel's videos, runs
transcript + LLM analysis, produces clip candidates, cuts clips, and publishes them back to YouTube.

Today the app is a single-user, local-first tool. Verified against the code (2026-09-02):

| Area         | Today                                                                                                    | Product needs                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Identity     | none — no user/tenant/session anywhere in `src/`                                                         | customers, sessions, login                                        |
| Channel      | `channels` row written only as a side effect of viewing one video; video lists are always live API calls | persisted channel + videos, 1:1 link to a customer, periodic sync |
| YouTube auth | one JSON file (`~/.config/video-clipper/youtube-auth.json`) for the whole process                        | one token set per customer, stored in DB                          |
| Config       | one process-wide singleton; `POST /api/config` mutates it globally; `DELETE /api/db` wipes everything    | operator config (keys, dirs) vs per-customer settings             |
| Heavy work   | runs inside the HTTP request; analysis/QA/upload stream SSE, clips/render are blocking with no progress  | durable background jobs with persisted progress                   |
| Storage      | one SQLite file, no FK constraints, no tenant column; media on local disk                                | tenant scoping on every table; per-customer media paths           |

What already works in our favour:

- Every orchestrator takes `cfg: Config` **as a parameter** (`src/lib/orchestration/*`), so per-customer config is an app-layer concern — no lib changes.
- Progress is reported through plain callback objects (`StreamCallbacks`, `QaStreamCallbacks`, `UploadDraftClipsCallbacks`), so a worker can persist progress exactly where the web layer frames SSE today.
- `initDb(path)` exists, the db barrel hides the raw handle, and `runMigrations()` is package-root relative.
- The catalog service (`src/lib/services/video/source/youtube/catalog.ts`) already resolves channels and pages the uploads playlist via the Data API with an API key.
- The PKCE OAuth flow in `src/lib/services/publish/oauth.ts` is reusable for sign-in with a wider scope set.

## Customer journey (target)

1. **Sign in with Google** (`/login`). Scopes: profile + `youtube.readonly` + `youtube.upload` + `youtube.force-ssl`.
2. **Callback = link.** Create the customer, call `channels.list(mine=true)`. Zero channels → error. Several (brand accounts) → pick one. Save the 1:1 link. Enqueue a `channel_sync` job. Redirect to `/`.
3. **Dashboard (`/`)** — the customer's channel header + its videos from the DB, each with a status: not analyzed · queued · analyzing 40 % · analyzed (n candidates) · clips ready · published. Actions: Analyze, Sync now.
4. **Video pages** — existing `/videos/[id]/...` flow; every heavy action enqueues a job and the page follows it.
5. **Settings** — connected channel, publish defaults, auto-analyze policy, caption presets (all per customer).
6. **Activity (`/jobs`)** — job list with status, progress, errors, retry.
7. **Ongoing** — the customer presses “Sync now” to pull new uploads and chooses which videos to analyze. Nothing runs unattended; a scheduler and auto-analyze are explicitly out of scope for v1.

## Decisions

| #   | Decision                            | Choice                                                                                                                                                                                                                                                                                                                                                                          | Why                                                                                                                                                              |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Hosting model                       | **confirmed:** one hosted deployment, many customers                                                                                                                                                                                                                                                                                                                            | self-serve SaaS; needs identity, tenant scoping, per-customer YouTube auth                                                                                       |
| D2  | Tenant key                          | `customer_id` denormalized onto every tenant-owned table, plus `customers.channel_id UNIQUE` for the 1:1 link                                                                                                                                                                                                                                                                   | tenancy could be derived via video → channel → customer, but a direct column makes every repo query and index trivial and safe                                   |
| D3  | Database                            | _(assumed)_ stay on SQLite for v1 (single node); port to Postgres when a second app/worker node is needed                                                                                                                                                                                                                                                                       | drizzle keeps the port mechanical; per-tenant SQLite files are **not** viable now because `db` is a process-global Proxy and switching it per request would race |
| D4  | Channel link mechanism              | **confirmed:** Google sign-in **is** the channel link (customer must own the channel)                                                                                                                                                                                                                                                                                           | one flow gives identity, upload rights, and owner-caption access; handle-only analysis can come later                                                            |
| D5  | Source media                        | **confirmed + verified:** transcript via the official `captions.download` with the customer's token; the **video file cannot be pulled through the Data API** (no media endpoint, owner or not), so clip cutting keeps the existing yt-dlp path (public videos work without cookies); upload-the-original is the later fallback; analysis-without-cutting is a first-class mode | official transcript access removes scraping for the core flow; there is no official route for the file                                                           |
| D6  | Auto-analyze new uploads            | **confirmed: none.** Analysis is on demand per video; channel sync runs on link and on “Sync now”; no scheduler in v1                                                                                                                                                                                                                                                           | LLM spend stays under the customer's control; no unattended work                                                                                                 |
| D7  | Jobs runtime                        | in-process worker loop in the SvelteKit server for v1; `video-clipper worker` as a separate process later                                                                                                                                                                                                                                                                       | the CLI already shares orchestration, so the split is cheap when needed                                                                                          |
| D8  | Transcript chain for owned channels | direct timedtext fetch (free, public videos) → owner `captions.download` (200 units; covers private/unlisted and bot-blocked) → yt-dlp → whisper                                                                                                                                                                                                                                | default quota is 10k units/day ≈ 50 caption downloads, so the free tier stays first; request a quota increase before onboarding channels with large backlogs     |
| D9  | Auth library                        | hand-rolled: extend the existing PKCE flow + `arctic` for Google, sessions table, cookie                                                                                                                                                                                                                                                                                        | avoids a framework; the OAuth code already exists                                                                                                                |

## Data model changes

New tables:

```
customers        (id PK, google_sub UNIQUE, email, name, avatar_url,
                  channel_id UNIQUE NULL → channels.id, created_at, updated_at)
sessions         (id PK, customer_id, expires_at, created_at)
youtube_auth     (customer_id PK, access_token, refresh_token, expiry_date, scope,
                  channel_id, connected_at, updated_at)           ← sqlite-migration step 2, now per customer
customer_settings(customer_id PK, settings_json, updated_at)      ← sqlite-migration step 3, now per customer
jobs             (id PK, customer_id, type, payload_json, status, progress_json,
                  error, attempts, run_after, created_at, started_at, finished_at)
usage_events     (id PK, customer_id, job_id, kind, units, cost_usd, created_at)
```

Existing tables:

- `channels` += `uploads_playlist_id`, `thumbnail_url`, `subscriber_count`, `video_count`, `last_synced_at`.
- `videos`, `chunks`, `segmentations`, `analyses`, `clips`, `publish_drafts`, `upload_artifacts`, `qa_messages`, `caption_presets` += `customer_id` (indexed). `caption_presets` stops being global.
- Add real FK constraints while adding the columns (none exist today).

Job types: `channel_sync`, `analyze_video`, `generate_clips`, `render_clip`, `publish_upload`, `qa` stays request-scoped.

## Config split

| Layer    | Source                                 | Examples                                                                            | Read by                |
| -------- | -------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------- |
| Operator | env / `.env` (existing `ConfigSchema`) | LLM keys, `YOUTUBE_API_KEY`, OAuth client, dirs, ffmpeg, concurrency                | app layer only         |
| Customer | `customer_settings` row                | `YT_DEFAULT_*` publish defaults, thresholds, prompts, auto-analyze, caption presets | merged per job/request |

`buildCustomerConfig(operatorCfg, customer)` overlays customer settings and sets per-customer `DOWNLOAD_DIR`/`OUTPUT_DIR` sub-paths, then hands the resulting `Config` to the orchestrators unchanged. `POST /api/config` becomes admin-only; `DELETE /api/db` is removed.

## Phases (each shippable, one commit per step)

### Phase 0 — lib prerequisites

- `youtube_auth` table + repo; `publish/authStore.ts` gains a DB-backed implementation keyed by customer (file store kept for the CLI).
- `customer_settings` table + repo; `config/fileStore.ts` stays for the CLI.
- `jobs` table + repo (`enqueueJob`, `claimNextJob`, `updateJobProgress`, `finishJob`, `listJobs`).
- Progress callbacks for `generateClipsForAnalysis` (per clip) and `renderEditedClip` (start/finish) — both have none today.
- `customer_id` migration on all tenant tables with a backfill to a single "default" customer so the CLI keeps working.

### Phase 1 — identity and tenancy

- ✅ `customers` + `sessions` tables (plus `auth_identities` and `library_videos`); Google sign-in via the existing PKCE flow with the wider scope set — today `oauth.ts` requests only `youtube.upload` + `youtube.readonly`; add `youtube.force-ssl` (required by `captions.download`); callback creates the customer, links the channel (1:1, unique), stores tokens in `youtube_auth`.
- ⬜ Session resolution now belongs to the backend's `middleware/session.ts`, not `hooks.server.ts`: `requireCustomer()` guard for every route under `/` and `/api` except `/login` and the auth callback.
- ⬜ Every repo read/write scoped by `customer_id`; remove the global `DELETE /api/db`; `POST /api/config` admin-only.
- ⬜ The backend's `http/oauthCookies.ts` and `routes/connection.ts` gain the sign-in routes beside them.

### Phase 2 — jobs and worker

- In-process worker started from `hooks.server.ts`: polls `jobs`, claims atomically (`UPDATE … WHERE status='queued'` is safe under SQLite's single writer), runs with `p-limit`, writes throttled progress, retries with backoff.
- Handlers per job type call the existing orchestrators with `buildCustomerConfig(...)` and map callbacks → `updateJobProgress`.
- `POST /api/jobs` + `GET /api/jobs/:id` (JSON) + `GET /api/jobs/:id/events` (SSE tail over the row). The current request-scoped SSE routes for analysis and uploads switch to enqueue-and-follow; clips and render gain progress for the first time.
- `/jobs` activity page; job status badges on video cards.

### Phase 3 — channel workspace

- `channel_sync` job: resolve channel → page the uploads playlist → `upsertVideo` for each; stop at the first already-known id for incremental runs; update `channels.last_synced_at`.
- No scheduler: sync runs on link and via a “Sync now” action; new videos show as _not analyzed_ until the customer chooses to analyze them.
- `/` becomes the customer dashboard (channel header, persisted video grid with per-video status). The landing "paste a handle" box is retired.

### Phase 4 — owned-channel transcripts and metering

- `OwnerCaptionsTranscriptProvider` (Data API `captions.list` + `captions.download` with the customer's token) inserted **second** in the transcript chain, after the free direct fetch and before yt-dlp/whisper (see D8).
- `usage_events` written per LLM call and per upload; per-customer usage on the dashboard.

### Phase 5 — scale-out (only when needed)

- `video-clipper worker` CLI command running the same worker loop out of process; upload-the-original fallback for videos yt-dlp cannot fetch.
- Postgres port of `schema.ts` and migrations; S3-compatible media storage behind `ClipperConfig.outputDir`; PubSubHubbub push for new uploads only if a scheduler is ever added.

## Web leftovers to move into lib (audit 2026-09-02)

The web service layer (`src/app/web/lib/services/**`) is pure adapters — SSE framing, HTTP helpers, config adapter, catalog factory. `src/hooks.server.ts` is clean. 24 of 32 route handlers are parse → orchestrate → shape. What remains is domain logic in a few routes and Svelte components; a second frontend (or the worker) would have to re-implement it. Fold these into Phase 0, highest value first:

| #   | Leftover                                                                                                                                                                                                                 | Where today                                                        | Move to                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1   | Thumbnail file store (MIME/ext allowlist, `mkdir`, `writeFile`, naming) — the only `fs` write in web                                                                                                                     | `routes/api/publish/thumbnails/+server.ts`                         | `services/publish/thumbnailStore.ts`                            |
| 2   | Transcript → subtitle-line builder (window filter, rebase, clamp, word-timing interpolation)                                                                                                                             | `widgets/video/clip-editor/ClipEditor.svelte` `importTranscript()` | `services/analysis/` beside `subtitlePlanner.ts`                |
| 3   | Word-timing helpers (even distribution, shift, rescale)                                                                                                                                                                  | `web/lib/subtitleTiming.ts`                                        | `services/video/clipper/editor/` beside `subtitleBuilder.ts`    |
| 4   | Publish scheduling rule (`start + n × YT_SCHEDULE_INTERVAL_MIN` over selected items, hardcoded `45` fallback) — exists nowhere in lib                                                                                    | `routes/.../prepare/+page.svelte` `applySchedule()`                | `services/publish/`                                             |
| 5   | Score-threshold re-applied client-side with a hardcoded `?? 7` fallback (three places)                                                                                                                                   | `routes/.../analysis/[analysisId]/+page.svelte`                    | stop re-deriving; expose the applied threshold on `ClipPlan`    |
| 6   | OAuth `state` + PKCE verifier generation (`randomBytes` + `toBase64Url`)                                                                                                                                                 | `routes/api/youtube/auth/start/+server.ts`                         | `services/publish/oauth.ts` (already owns URL build + callback) |
| 7   | Q&A citation parser (`[mm:ss]` markers → `QaTextSegment`)                                                                                                                                                                | `widgets/video/analysis/VideoQaPanel.svelte` `parseSegments()`     | `services/analysis/qa/`                                         |
| 8   | Built-in caption templates (5 presets)                                                                                                                                                                                   | `web/lib/captionTemplates.ts`                                      | `services/video/clipper/editor/`                                |
| 9   | Workflow step model + gating (analyze → clip → connect → prepare → publish), duplicated between `videoWorkflow.ts` and `+layout.server.ts` redirects                                                                     | `web/lib/videoWorkflow.ts`, `web/types/workflow.ts`                | `@lib/types/workflow.ts` + a lib `resolveWorkflowState()`       |
| 10  | Caption-preset JSON encode/decode done in routes and store instead of the repo                                                                                                                                           | `routes/api/caption-presets/*`, `stores/captionPresets.ts`         | `db/repos/captionPresetsRepo.ts`                                |
| 11  | Small: clip file variant resolution (`edited` vs original), caption-track → language mapping, `upsertChannel`/`upsertVideo` write-through on video view, `0.045` text-scale constant duplicated in two canvas components | various                                                            | `clipEditOrchestrator`, catalog service, `utils/textScale.ts`   |

Hygiene, not architecture: four copies of `readApiError` in `web/lib/` (`api.ts`, `analysisStream.ts`, `qaStream.ts`, `uploadStream.ts`); the `analysisService`/`transcriptService`/`clipService` passthrough files add nothing and can go.

## Risks

- **yt-dlp on a server** is the biggest operational risk (D5). Owner captions (D8) remove it for transcripts; clip cutting still needs the file, and there is no official way to get it — the upload-the-original fallback (Phase 5) is the mitigation.
- **YouTube Data API quota** is 10k units/day per project: sync is cheap (1 unit per page), `captions.download` is 200, uploads are 1600 each. Keep the free direct fetch first in the chain and apply for a quota increase before self-serve.
- **Google OAuth verification** is required for `youtube.upload` in production; plan for the review.
- **SQLite single writer**: fine for one node with a small worker pool; the worker must not hold long transactions around LLM calls.

## Verification (per phase)

```bash
npx tsc --project tsconfig.test.json --noEmit
npx vitest run                         # + repo tests for jobs / customers / youtube_auth
pnpm web:check
```

- Phase 1: two customers in the same DB cannot see each other's videos, analyses, clips (integration test over the repos).
- Phase 2: enqueue `analyze_video`, kill the server mid-run, restart → job resumes or is retried; progress visible via `GET /api/jobs/:id`.
- Phase 3: link a real channel, confirm `videos` rows and dashboard statuses; second sync is incremental.
- End to end: sign in → sync → analyze → clips → publish, all as jobs, with the browser closed in between.
