# Prototype → Product — three apps, corrected structure

> **Status: IN PROGRESS** — approved 2026-09-03. Rebuilding `feat/customer-onboarding` from master. The prototype it replaces is preserved on the `reference/customer-onboarding-prototype` branch and on the remote; read it for behaviour, not for layout.

## Context

What exists today is a working **prototype**: a single-user local tool where SvelteKit serves both the
pages and all 37 API routes, the CLI opens the database directly, and there is no identity layer. It
works, and the domain logic in `src/lib/` is genuinely good — that part earned its place.

PR #36 (customer onboarding) surfaced two structural problems, and the decision is not to merge it. The
commits get reset, the code is kept **as reference**, and the branch is rebuilt as product structure.

The governing rule for this work: **treat the prototype as a specification of behaviour that works, not
as a layout to preserve.** Where it got the shape right, carry it over. Where it was a prototype
convenience, correct it or drop it. Do not port mistakes forward for the sake of a smaller diff.

## What we keep, correct, and drop

| Keep as-is                                                                  | Correct                                                | Drop                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| All of `src/lib/` — services, orchestration, pipeline, types, config, utils | Identity model: no provider column on `customers`      | `DELETE /api/db`, an unauthenticated whole-database wipe                                    |
| The SQLite schema and repo conventions                                      | HTTP layer moves out of SvelteKit into its own app     | Manual YouTube token paste — an OAuth workaround, not a product affordance                  |
| The design system, components and widgets                                   | Routes get product names, not prototype ones           | `/legacy/*` — the prototype itself is the reference now                                     |
| The transcript, analysis, clip and publish flows                            | Everything guarded by default; public is the exception | `analysisService`, `qaService`, `transcriptService`, `clipService` — 4–23 line passthroughs |
| SSE as the progress mechanism                                               | CLI stops writing the database directly                | Reading `@lib` from the web app                                                             |

## Fix 1 — the identity model must not name a provider

**What `google_sub` was.** The `sub` claim from Google's OpenID userinfo endpoint, the account's
permanent id. It exists because email is unsafe as a key: a Google address can change, and a deleted
Workspace address can be reassigned to someone else, so keying on email lets a rename orphan a
customer's library and a reassignment hand it to a stranger.

**Why it is still wrong.** That argues for keying on a stable provider id, not for a _Google_ column in
the core `customers` table. A second sign-in method would mean another nullable column.

```
customers        id PK · email · name · avatar_url · channel_id · created_at · updated_at
                 who someone is. No auth columns at all.

auth_identities  id PK · customer_id · provider · provider_account_id · created_at · updated_at
                 UNIQUE(provider, provider_account_id) · idx(customer_id)
                 how they signed in. 'google' is a value, not a schema decision.
```

| File                                          | Change                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `services/db/schema.ts`                       | drop `googleSub` from `customers`; add `authIdentities`                                                        |
| `services/db/repos/customersRepo.ts`          | `findCustomerByGoogleSub` → `findCustomerByIdentity(provider, accountId)`; `upsertCustomer` takes profile only |
| new `services/db/repos/authIdentitiesRepo.ts` | link and resolve an identity                                                                                   |
| `types/auth.ts`                               | `Customer` loses `googleSub`; add `AuthProvider`, `AuthIdentity`                                               |
| `orchestration/authOrchestrator.ts`           | resolve customer via identity; the claimed-channel check compares customer ids                                 |
| `drizzle/0010_*.sql`                          | regenerated — the commits are being reset, so no second migration                                              |

**Deliberately unchanged.** `utils/googleOAuth.ts` and the `Google*` types stay Google-named; they _are_
the Google adapter. The rule is narrow: **identity tables must not name a provider; adapters should.**

> **Superseded by the PR #36 review.** This section originally kept `youtube_auth`, on the grounds that
> a connected channel is domain rather than authentication. The review disagreed, and it was right: the
> table held tokens keyed by a provider's name. Tokens, channel and provider-specific metadata are all
> columns on `auth_identities` now, `customers.channel_id` is gone, and `authOrchestrator.ts` has split
> into `orchestration/auth/{base,google}.ts`. See [From the PR #36 review](#from-the-pr-36-review).

## Fix 2 — three apps

`src/lib/` **is already the backend logic** — framework-free, config injected as a parameter. What is
missing is an HTTP server of its own; SvelteKit's route files play that role today. So this is lifting
the HTTP layer out, not rewriting the product.

Three prototype hazards disappear as a side effect: two processes writing the same SQLite file, config
changes that never propagate between processes, and the npm tarball shipping ~83 compiled web files
because one `tsconfig` compiles all three trees.

### Framework: Hono

SvelteKit handlers already take and return standard Web `Request`/`Response`, and so do Hono's, so the
handler bodies carry over rather than being rewritten — Fastify and Express use Node req/res and would
force a rewrite of every one, streaming worst. Hono also ships server-sent events, which three flows
need, is TypeScript-first on NodeNext ESM, and pairs with `@hono/zod-validator` to match the zod
validation already in every route.

### Same-origin, always

The frontend keeps calling relative `/api/...` URLs; Vite proxies to the backend in dev, a reverse proxy
in production. This removes CORS, `SameSite=None`, `credentials: 'include'`, absolute URLs, and any
change to the 40-plus frontend calls. Server-side page loads are the exception and go direct over an
internal URL, forwarding the session cookie through one helper.

## Target layout

```
src/
  lib/                        # UNCHANGED. The prototype got this right
  app/
    api/                      # NEW — the backend
      index.ts                #   entry: migrations, config, listen
      app.ts                  #   Hono instance, middleware, route mounting
      context.ts              #   typed Env { requestId, config, customer }
      middleware/             #   requestContext · session · errorEnvelope
      routes/                 #   one file per resource
      http/                   #   responses · sse · cookies
      services/               #   framework-agnostic helpers lifted from web
    web/                      # SvelteKit — pages only, no @lib imports
      hooks.server.ts         #   moved here via kit.files.hooks
      lib/server/backend.ts   #   server fetch that forwards the session cookie
    cli/
      client/                 #   typed HTTP client
      commands/               #   rewritten against it
```

## API surface: product shape

Resource-shaped and consistent. Most URLs are unchanged, so the frontend contract mostly holds; the
corrections are called out.

| Backend file        | Routes                                                                                             | Correction from the prototype                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.ts`           | `GET /api/me`, `/api/auth/google/{start,callback}`, `POST /api/auth/signout`                       | `/api/me` is new — the page guard and library load reach into the library in-process today     |
| `channel.ts`        | `GET /api/channel`, `GET /api/channel/videos`                                                      | —                                                                                              |
| `videos.ts`         | `GET /api/videos`, `GET                                                                            | POST                                                                                           | DELETE /api/videos/:id`, `/api/videos/:id/transcript{,/languages}`, `/api/videos/:id/qa`           | library listing moves from `/api/library/videos`; **`DELETE /api/videos/:id/analysis` replaces `/api/cache/videos/:id/analysis`** — it clears data, it was never a cache |
| `analyses.ts`       | `GET /api/analyses`, `GET /api/analyses/:id`, `POST /api/analyses` (SSE)                           | was `/api/library/analyses` and `/api/analysis/transcript`; "library" was a prototype grouping |
| `clips.ts`          | `GET                                                                                               | POST /api/clips`, `/api/clips/:id/{file,edits,render,subtitles/plan}`                          | clip listing folds in from `/api/library/clips`                                                    |
| `publish.ts`        | `/api/publish/drafts{,/:analysisId,/generate}`, `/api/publish/thumbnails`, `/api/publish/uploads`  | uploads move off the `/api/youtube/` prefix — it is our publish flow, not a YouTube API mirror |
| `youtube.ts`        | `GET /api/youtube/channels/resolve`, `/api/youtube/channels/:id/videos`, `/api/youtube/videos/:id` | kept: these genuinely proxy the YouTube API                                                    |
| `connection.ts`     | `GET                                                                                               | DELETE /api/youtube/connection`, `/api/youtube/connection/oauth/{start,callback}`              | replaces `/api/youtube/auth/{status,disconnect,start,callback}`; **manual token paste is dropped** |
| `captionPresets.ts` | `/api/caption-presets{,/:id}`                                                                      | serialization moves into the repo, out of the route                                            |
| `settings.ts`       | `GET                                                                                               | PATCH /api/settings`                                                                           | was `/api/config`; **admin-scoped**, since it mutates process-global state for everyone            |
| —                   | —                                                                                                  | **`/api/db` is deleted.** An unauthenticated database wipe is a prototype debug tool           |

Guarding inverts: the backend guards everything by default and a route opts out, rather than 34 of 37
being open as they are now.

## File mapping

| Prototype                                           | Product                          | Note                                              |
| --------------------------------------------------- | -------------------------------- | ------------------------------------------------- |
| `web/lib/services/http/responses.ts`                | `api/http/responses.ts`          | `parseJsonBody(request, schema)`; `Response.json` |
| `web/lib/services/auth/loginCookies.ts`             | `api/http/sessionCookies.ts`     | `Set-Cookie` serialization                        |
| `web/lib/services/auth/requireCustomer.ts`          | `api/middleware/session.ts`      | resolves the session itself                       |
| `web/lib/services/analysis/streamEvents.ts`         | `api/http/sse/analysisEvents.ts` | as-is                                             |
| `web/lib/services/analysis/qaStreamEvents.ts`       | `api/http/sse/qaEvents.ts`       | as-is                                             |
| `web/lib/services/publishing/uploadStreamEvents.ts` | `api/http/sse/uploadEvents.ts`   | as-is                                             |
| `web/lib/services/youtube/oauthCookies.ts`          | `api/http/oauthCookies.ts`       | as-is                                             |
| `web/lib/services/youtube/catalogFactory.ts`        | `api/services/catalogFactory.ts` | as-is                                             |
| `web/lib/services/config/webConfig.ts`              | `api/services/appConfig.ts`      | renamed                                           |
| `web/lib/services/artifacts/artifactStore.ts`       | `api/services/artifactStore.ts`  | as-is                                             |
| `web/lib/services/{analysis,clipping}/*Service.ts`  | deleted                          | inlined into handlers                             |
| `src/hooks.server.ts`                               | `app/web/hooks.server.ts`        | gutted: request id and session only               |
| `web/routes/legacy/**`                              | deleted                          | the prototype is the reference                    |

**Untouched in the web app:** `lib/api.ts`, the three SSE clients, all stores, `activity/`, `format.ts`,
`captionTemplates.ts`, `subtitleTiming.ts`, `videoWorkflow.ts`, `components/`, `widgets/`, `types/`,
`style/`, and every page route. One file is added, `lib/server/backend.ts`.

**CLI:** new `cli/client/`; the eight commands rewritten against it; `index.ts` stops running
migrations; `args.ts` stops reading `@lib/config` for defaults, since the backend owns them. yt-dlp and
ffmpeg work stays in-process.

## Commit series

Reset to master, keep the working tree, then build forward. Structure first, feature second, so both
halves are reviewable.

| #   | Commit                        | Contents                                                                                                               |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | `chore(build)`                | per-app tsconfigs, dedupe the six aliases declared in five places, scripts, clean step, stop shipping web files to npm |
| 2   | `feat(api)`                   | backend skeleton: Hono app, entry, context, middleware, `http/`                                                        |
| 3   | `refactor(api)`               | lift the agnostic helpers; rewrite the three SvelteKit-coupled ones                                                    |
| 4–6 | `feat(api)`                   | routes by group — catalog and reads, then media and clips, then auth, publish and streaming                            |
| 7   | `refactor(web)`               | delete `routes/api/` and `routes/legacy/`, add proxy and server-fetch helper, move hooks, drop `locals.config`         |
| 8   | `refactor(cli)`               | HTTP client; commands call it                                                                                          |
| 9   | `test(boundaries)`            | rewrite the architecture test for three apps; add web-never-imports-lib and cli-never-imports-web                      |
| 10  | `docs`                        | structure, running three processes, deployment                                                                         |
| 11  | `feat(auth)`                  | provider-independent identity: `auth_identities`, repos, orchestrator                                                  |
| 12+ | `feat(auth)`, `feat(library)` | customer onboarding rebuilt on the new structure                                                                       |

## Things that will bite

- **`serviceBoundaries.test.ts`** hardcodes `../src` and the alias prefixes, and does **not** currently
  forbid CLI-to-web imports. Rewrite it, and add the two missing rules.
- **Aliases live in five files** and `vitest.config.ts` has only three of the six. Consolidate in
  commit 1, before adding a fourth app to the drift.
- **`svelte.config.js` and `vite.config.ts` use cwd-relative `path.resolve`**, so anything that changes
  the working directory breaks all six aliases.
- **`hooks.server.ts` lives outside the web app** and is the only place config, migrations and session
  are wired. Moving it needs `kit.files.hooks`.
- **CI never builds or type-checks the web app.** `.svelte` files are only format-checked. Add both.
- **`tests/setup.ts` mocks a path that has not existed since the lib refactor.** The mock is dead.
- **`PACKAGE_ROOT`** is a hardcoded three levels up and resolves `drizzle/` and the Python scripts. It
  survives only because `src/lib` does not move.
- **`dist/` is never cleaned** and still ships pre-refactor artifacts.

## Deferred

- **CLI authentication.** Fine while the backend is local; required the moment it is not.
- **pnpm workspaces and separate manifests** — packaging, worth doing when the apps deploy separately.
- **Deployment.** No Dockerfile or process config exists, and the backend needs ffmpeg, yt-dlp, Python
  and a native SQLite build. Its own plan.
- Customer-scoping analyses, clips and drafts. Still global after this work.

## Verification

```bash
pnpm type-check && pnpm test && pnpm web:check && pnpm build
pnpm api:dev     # backend on :5003
pnpm web:dev     # frontend on :5002, proxying /api
```

- Every frontend call still answers through the proxy; the renamed routes are updated at their callers.
- The three SSE streams still stream and abort on disconnect; clip playback still serves byte ranges so
  seeking works; thumbnail upload still writes to disk.
- Sign in, browse, add and remove a video, run an analysis, cut a clip, end to end.
- `video-clipper library` and `analyze` work against a running backend, and fail with a clear message
  when it is down rather than a stack trace.
- The architecture test proves the web app no longer imports `@lib`.
- `grep -ri google src/lib/services/db src/lib/types/auth.ts` returns nothing outside the adapter.
- `pnpm build` output contains no web files and the packed tarball shrinks.

## Progress

| #   | Commit                                                      | State                                          |
| --- | ----------------------------------------------------------- | ---------------------------------------------- |
| 1   | `chore(build)` split the build per app, consolidate aliases | ✅ `9aa0396`                                   |
| 2   | `feat(api)` backend skeleton                                | ✅ `ee2a669`                                   |
| 3   | `refactor(api)` lift the shared helpers                     | ✅ `9187b33`                                   |
| 4–6 | `feat(api)` routes by group                                 | ✅ `9187b33` — all nine groups mount           |
| 7   | `refactor(web)` frontend only                               | ✅ `9187b33` — no `@lib` domain imports remain |
| 8   | `refactor(cli)` talk to the backend                         | ✅ `523f1c0`                                   |
| 9   | `test(boundaries)` three-app rules                          | ✅ `ddb7b0e`, CLI rule in `523f1c0`            |
| 10  | `docs` structure and deployment                             | ✅ `ddb7b0e` — deployment still deferred       |
| 11  | `feat(auth)` provider-independent identity                  | ✅ `8c9a5c6`                                   |
| 12  | `feat(api)` sign-in, channel and library routes             | ✅ `698c3c3`                                   |
| 13  | `feat(web)` login, library, browse, topbar                  | ✅ `4dea2ca`                                   |

### Shipped in 12 and 13

Sign in with Google, land on your library, browse your channel's uploads, add and remove videos,
sign out. `GET /api/me`, `/api/auth/google/{start,callback}`, `POST /api/auth/signout`,
`GET /api/channel{,/videos}`, and library membership on `/api/videos`.

### One correction to this plan

The plan says guarding inverts: the backend denies by default and a route opts out. It does not, yet.
The CLI has no way to sign in — that was already listed under Deferred — so denying by default would
break every command that moved onto HTTP in `523f1c0`. Session resolution runs on every request; the
routes that reach into one customer's data guard themselves with `requireCustomer`. Inverting the
default is blocked on CLI authentication, and should land with it.

### Still open

| Area               | What                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------- |
| tenancy            | analyses, clips and drafts are still global — a customer's library is scoped, its work is not |
| `youtube_auth`     | written at sign-in, but publish still reads the single-file store                             |
| private uploads    | browse lists the public uploads playlist; using the customer's own token would show the rest  |
| `DELETE /api/db`   | gone from the backend, but nothing replaced it for local development                          |
| CLI authentication | see the correction above                                                                      |

Note: the backend listens on **5051**, not 5003, because another process holds 5003 on the
development machine. Override with `API_PORT` and `API_ORIGIN`.

### From the PR #36 review

The draft review on PR #36 held six design items. Most share one theme: **the provider-independence
rule was applied to `auth_identities` and then stopped there.** `google_sub` was the first instance,
not the only one. Four are now done; two are not, for reasons worth writing down.

| What                                                                                        | Where it stands                                                             |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| An OAuth base with per-provider children — `authOrch/base`, `authOrch/google`, later twitch | done — `orchestration/auth/{base,google}.ts`                                |
| `customers.channel_id` is a YouTube concept on a provider-neutral table                     | done — the column is gone; `Customer.channelId` is derived via the identity |
| `youtube_auth` should be a generic auth table keyed by `type` with a `metadata` blob        | done — folded into `auth_identities`, which now carries tokens and metadata |
| `library_videos.video_id` should be a url, which survives a change of provider              | **not done** — see below                                                    |
| Config should read as `GOOGLE: { … }`, not four keys sharing a prefix                       | done — `groupConfig(cfg)`, groups derived from the flat schema              |
| Sessions should be our own JWT issued after OAuth succeeds                                  | **not done** — see below                                                    |

#### Why the video id is still an id

`video_id` is not local to `library_videos`. It is the join key for `chunks`, `segmentations`,
`analyses`, `clips`, `qa_messages`, `publish_drafts` and `upload_artifacts`, all of which key off
`videos.id`. Changing it in one table alone would break the join to the catalog; changing it everywhere
is a migration of the whole schema and every repo that reads it.

The comment is right about the direction. The shape it wants is a provider-qualified catalog —
`videos` gaining `provider` and `url`, with the id becoming meaningful only within a provider. That is
its own piece of work, and it should land before there is a second provider rather than alongside one.

#### Why sessions are still opaque tokens

This is a fork, not a cleanup. Sign-out today deletes a row, and the session dies on the next request.
A JWT verified from its signature alone cannot be revoked, so the same sign-out would leave a valid
token in the wild until it expired.

Having both means a short-lived access JWT (~15 min) plus the current opaque token as a refresh
credential: two cookies, silent re-issue in the session middleware, and a signing secret in config.
That is a real feature, and on a single-node SQLite backend it buys nothing today — the DB lookup it
avoids is one indexed point read on the same machine. It also has to be settled together with CLI
authentication, which is already deferred above and would consume the same tokens.

Worth doing when the backend stops being local. Not worth hand-rolling HS256 to get there early:
`src/lib` is framework-free, so Hono's `hono/jwt` helper is not available to it.
