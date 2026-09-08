# Agent Instructions

## Project

Three apps over one TypeScript library: a SvelteKit frontend, a Hono backend that owns state and orchestration, and a CLI. Analyzes YouTube transcripts with an LLM to find interesting moments and cut video clips.

The _Project Structure_ section below is the architecture reference. `docs/README.md` indexes the user guides, design assets, and plans (active in `docs/plans/`, shipped in `docs/plans/archive/`).

## Stack

- TypeScript (Node.js 18+)
- Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/xai`, `@ai-sdk/mistral`, `@ai-sdk/groq`) with `generateObject` + `zod` for structured LLM output
- Multi-provider support: OpenAI, Anthropic, Google, XAI, Mistral, Groq, Zai, OpenRouter
- `yt-dlp` + `execa` for video download and subtitle extraction fallback
- `fluent-ffmpeg` for clip cutting
- `zod` for config validation at startup
- `p-limit` for concurrency control
- SvelteKit + Vite for web UI
- `tsc-alias` for path alias resolution in CLI builds

## Path Aliases

Four aliases. Everything shared flows through `@lib`; each app has its own.

| Alias        | Resolves To     | Purpose                                                               |
| ------------ | --------------- | --------------------------------------------------------------------- |
| `@lib/*`     | `src/lib/*`     | Core library (types, config, utils, services, shared pipeline stages) |
| `@app/api/*` | `src/app/api/*` | Backend HTTP app                                                      |
| `@app/cli/*` | `src/app/cli/*` | CLI application                                                       |
| `@app/web/*` | `src/app/web/*` | Web application (SvelteKit)                                           |

Same-directory imports (`./foo.js`) stay relative. All `.js` extensions are required (NodeNext).

The JS-side tooling (Vite, SvelteKit, Vitest) reads these from `aliases.js` at the repo root;
`tsconfig.json` keeps its own `paths` because TypeScript cannot read JS config. Those two must stay
in step — they used to live in five files and had already drifted.

## Project Structure

```
src/
  lib/                        # Core library — source of truth
    index.ts                  # Public API barrel (types, utils, services, orchestration)
    types/                    # ALL shared types + zod schemas — a LEAF module
      index.ts, config.ts, transcript.ts, segment.ts, audio.ts, video.ts,
      cli.ts, command.ts, pipeline.ts, analyzer.ts, downloader.ts, factory.ts,
      youtube.ts, analysis.ts, qa.ts, clipEdit.ts, publish.ts, subtitlePlan.ts,
      db.ts, modelFactory.ts
    config/                   # Config machinery (env schema loading, file store, registry)
      env.ts                  # zod-validated env — apps import this, never process.env
      fileStore.ts, registry.ts, index.ts
    utils/                    # Shared leaf utilities
      logger.ts, format.ts, paths.ts, pythonBin.ts, chunker.ts, ids.ts,
      retryAsync.ts, textScale.ts, transcriptUtils.ts
    services/                 # Independent services — one barrel each (index.ts)
      modelFactory/           # Model/AudioModel/defineTool over the Vercel AI SDK
      video/                  # source/youtube (parser, metadata, downloader,
                              #   subtitles, catalog) + clipper (ffmpeg, editor)
      audio/                  # source, processor (slicer, detector),
                              #   analyzer (gemini/whisper/yamnet),
                              #   transcriber (ytdlp/whisper/gemini)
      analysis/               # llm, ranker, refiner, transcript (detector/chunker),
                              #   qa, subtitlePlanner, prompts
      publish/                # oauth, authStore, uploadClient, metadata(+cache), prompts
      db/                     # drizzle client (lazy), migrate, repos/ (one per table)
    orchestration/            # The only lib layer that touches services/db. Shared by
                              # CLI + web: transcript / analysis / clip / qa /
                              # publish / clipEdit orchestrators
    pipeline/stages/          # Stateless shared stages
      segmentAnalyzer.ts      # LLM analysis + transcript detection
      segmentSelector.ts      # Segment ranking + selection
      clipExporter.ts         # Video download + clip generation

  app/
    api/                      # Backend — the only process that owns the db and reads config
      index.ts                # entry: migrations, then listen on API_PORT
      app.ts                  # Hono instance, middleware, route mounting
      context.ts              # typed request context (requestId, config)
      middleware/             # requestContext (id + config + logging) · errorEnvelope (onError)
      routes/                 # one file per resource: analyses, clips, videos, qa, youtube,
                              #   connection, publish, captionPresets, settings
      http/                   # responses · sse/ · oauthCookies
      services/               # appConfig, catalogFactory, artifactStore

    cli/                      # CLI application — HTTP client + local media work
      client/                 # apiGet / apiSend / apiStream against the backend
      index.ts                # CLI entrypoint (shebang, runs migrations)
      args.ts                 # parseArgs + printUsage for the run command
      commands/               # Subcommands: run, analyze, clip, candidates,
                              #   library, channel, ask, config
      output/                 # formatter + progress rendering

    web/                      # Web application (SvelteKit)
      app.html                # SvelteKit HTML template
      style/                  # Global styles (CSS custom properties, reset, typography)
        variables.css         # Design tokens (colors, radii, spacing, fonts)
        reset.css             # Global resets (box-sizing, body, button/input inherit)
        typography.css        # .eyebrow, .muted, .error-text utility classes
        index.css             # @import barrel
      components/             # Generic/atomic UI primitives (reusable anywhere, no domain knowledge)
        Button.svelte         # primary/outline variants, disabled state
        Pagination.svelte     # prev/next pager
        YouTubeEmbed.svelte   # responsive 16:9 iframe
        # … other generic primitives (Badge, Card, Field, Icon, Input, Select, etc.)
      widgets/                # Domain/feature-specific components (not generically reusable)
        ChannelCard.svelte    # channel thumbnail + title + link
        VideoCard.svelte      # video thumbnail + duration + title
        CandidateCard.svelte  # clip candidate with checkbox + score
        AnalysisProgress.svelte
        publish/              # Publish-flow widgets
        settings/             # Settings-page widgets
        video/                # Video-analysis-page widgets
      lib/                    # SvelteKit $lib
        index.ts              # app name etc.
        api.ts                # readApiError(), apiFetch<T>()
        format.ts             # formatDuration(), formatTime()
        services/             # Thin web glue over lib orchestrators/services
          analysis/           # SSE adapters for analysis/transcript/qa
          clipping/           # Pass-through to clipOrchestrator
          artifacts/          # Read wrappers over db repos
          publishing/         # Upload SSE event serialization
          youtube/            # Catalog factory + OAuth cookie constants
          config/             # Web config adapter (toYouTubeOAuthConfig etc.)
          http/               # SvelteKit HTTP response helpers
      routes/                 # SvelteKit file-based routing
      types/                  # Web-only types
        analysis.ts           # TranscriptBundle, ClipPlan, ClipArtifact, etc.
        web.ts                # ApiError

tests/                        # Unit tests (mirrors module names)
downloads/                    # yt-dlp output (gitignored)
outputs/                      # ffmpeg clip output, caches, dumps (gitignored)
```

## Architectural Boundaries

Three apps over one library. The library holds the domain logic; the apps are thin.

```
app/web/  ──HTTP──>  app/api/  ──imports──>  src/lib/  ──>  (external packages only)
app/cli/  ──HTTP──>  app/api/
```

- **`src/lib/`** is the domain: services, orchestration, pipeline, types, config, utils. It never
  imports from `src/app/`.
- **`app/api/`** is the only process that owns the database and reads config. It is a thin HTTP shell
  over `src/lib/`.
- **`app/web/`** is a frontend. It holds **no domain logic** and opens no database. It may import
  `@lib/types/*` and `@lib/utils/*`; importing services, orchestration, pipeline or config fails the
  architecture test.
- **`app/cli/`** talks to the backend over HTTP for anything stateful. Local media work — yt-dlp and
  ffmpeg acting on the user's own files — stays in-process, because it needs the user's disk.
- **The three apps never import each other.** Anything two of them need belongs in `src/lib/`, which
  is why the HTTP contract lives in `src/lib/types/api.ts`.

Same-origin is deliberate: the browser calls relative `/api/...` URLs and Vite proxies them to the
backend, so cookies, OAuth redirects and the existing fetch calls need no cross-origin handling.
Server-side page loads are the exception and call the backend directly, forwarding the session cookie
via `src/app/web/lib/server/backend.ts`.

### Running it

```bash
pnpm api:dev     # backend, API_PORT (5051 by default)
pnpm web:dev     # frontend on 5002, proxying /api
```

### Boundaries enforced by `tests/serviceBoundaries.test.ts`

- `src/lib/types/` is a **leaf**: it imports nothing from `@lib/*` or `@app/*`
- From outside a service, import only its barrel: `@lib/services/<svc>/index.js`
  (deep paths — alias or relative — fail the test). Types always come from `@lib/types/*`.
  Intra-service imports stay relative.
- Cross-service edges are limited to `* → modelFactory` and `audio → video`
- Within `src/lib/`, only `orchestration/` and the public barrel import `services/db`
- `services/`, `orchestration/` and `pipeline/` never import `@lib/config` — config is injected by
  the app layer, which is what lets the backend own it exclusively
- The web app never imports lib domain logic
- The apps never import each other

## Code Rules

- All code in TypeScript — no plain `.js` files
- Every function must have explicit input/output types; avoid `any`
- Use `zod` for all external data validation (LLM output, env vars, API responses)
- Never read `process.env` directly — always import from `@lib/config/index.js` (app layer only; lib services receive config as typed parameters)
- Never hardcode API keys, model names, thresholds, or directory paths — all come from config
- Use `async/await` — no raw `.then()` chains
- Use `Promise.allSettled` for parallel LLM calls so one failure doesn't abort the rest
- Handle errors explicitly — no silent catches. Log a warning with the chunk index and reason on skip.

## Types location (hard rule)

Every `interface` and `type` declaration lives in `src/lib/types/` (shared/server) or `src/app/web/types/` (web). This includes Svelte component `Props` interfaces — Svelte 5 conventions notwithstanding. Inline declarations break reuse: callers cannot import them across files.

- Before declaring a new type → run `/new-type <Name> <purpose>` and use the decision table to pick the destination file.
- To audit the repo for offenders → `/audit-types`.
- To clean up an existing offender → `/extract-inline-types <path>`.
- The `.claude/hooks/no-inline-types.sh` PreToolUse hook also blocks any Write/Edit that would re-introduce an inline declaration in `src/`.

## LLM Usage

- Use `generateObject` (not `generateText`) for all LLM calls that return structured data
- Define a `zod` schema for every LLM response before writing the prompt
- Default system prompts live in the owning service's `prompts.ts` (`analysis/prompts.ts`, `publish/prompts.ts`); call-site prompt _construction_ stays with the function that uses it
- Do not retry on malformed JSON — `generateObject` handles structured output natively
- On any LLM call failure, catch and log, then continue — never crash the pipeline

## Module Conventions

Each service module in `src/lib/services/` should:

- Export a single main function named after the module (e.g. `parseUrl`, `buildChunks`)
- Accept typed inputs and return typed outputs (no `any`)
- Import only `@lib/types/*`, `@lib/utils/*`, and same-service files (relative) — never `@lib/config`; cross-service imports only on the allowed edges via the target's barrel
- Re-export its public surface from the service's `index.ts` barrel — that barrel is the only entry point outside consumers may use

## Transcript Notes

- Micro-blocks group raw lines into ~15s windows before chunking
- LLM chunks are 120s windows with 20s overlap — built from micro-blocks, not raw lines

### Transcript fetch strategy (`src/lib/services/video/source/youtube/subtitles.ts`)

Two-tier fetch, in order:

1. **Direct YouTube caption fetch (primary)** — reads `ytInitialPlayerResponse` from the YouTube watch page HTML, picks the best English caption track, fetches it via the `timedtext` endpoint as VTT. No yt-dlp, no cookies required for public videos.
2. **yt-dlp subtitle extraction (fallback)** — used when the direct fetch returns no tracks or throws (e.g. `LOGIN_REQUIRED`). Always passes `--format mhtml` so yt-dlp can select a format even when the TV-client n-challenge JS solver fails (Deno bug that produces "Requested format is not available"). Cookies are applied here via `YT_DLP_COOKIES_FROM_BROWSER` / `YT_DLP_COOKIES_FILE`.

When working on transcript fetch code:

- Do not remove `--format mhtml` from the yt-dlp args — it is required for bot-gated videos
- `YT_DLP_COOKIES_FROM_BROWSER` supports a profile suffix: `chrome:Profile 1`; bare `chrome` uses the Default profile which may have stale cookies
- Auth errors from the direct fetch are caught and re-thrown as human-readable messages pointing to the cookie config vars

### Download segment notes (`src/lib/services/video/source/youtube/downloader.ts`)

- **Cookies are intentionally omitted from `downloadSegment()`** — supplying cookies forces yt-dlp into the TV+web_creator client, which downloads `tv-player-ias.js` and tries to solve the n-challenge inside it. That JS file uses `self.location.origin` (a browser-only global) and crashes in both Deno and Node.js with `TypeError: Cannot read properties of undefined (reading 'origin')`. Without cookies, yt-dlp auto-selects the `ANDROID_VR` client whose pre-signed `c=ANDROID_VR` DASH URLs bypass the n-challenge entirely. The n-challenge warning still appears in logs but is harmless.
- **Consequence**: `PARTIAL_DOWNLOAD_ENABLED=true` (per-segment download path) is incompatible with private and age-gated videos. Those must use `PARTIAL_DOWNLOAD_ENABLED=false` (full-video download path), which passes cookies normally and does not invoke the TV client.
- Do not add cookie flags back to `downloadSegment()` — doing so silently breaks all public video downloads on Node.js.

### Clip output cache (`src/lib/services/video/clipper/index.ts`)

Both `generateClips()` and `remuxClips()` check whether `{outputDir}/{videoId}_{startInt}_{endInt}.mp4` already exists before doing any work. If the file is present they log `Clip already exists, skipping: <path>` and return the cached path immediately. This mirrors the same `fs.access` pattern used in `downloadSegment()` for `downloads/`. Do not remove these checks — they prevent redundant re-encodes and re-remuxes on repeated runs.

## Naming

- Files: `camelCase.ts`
- Functions: `camelCase`
- Types/interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Zod schemas: `PascalCase` + `Schema` suffix (e.g. `SegmentSchema`)

## Testing

- Write unit tests for pure functions (URL parser, chunker, ranker, deduplicator)
- Do not unit test functions that call external services (LLM, yt-dlp, ffmpeg) — integration test those separately
- Test files live in `tests/` at the project root, mirroring the module name (e.g. `tests/urlParser.test.ts`)
- When taking screenshots etc via playwright keep it in temp/ folder(always)
- For testing UI etc.. you should navigate to that page and take screenshot etc.. to verify components.

## Git

- One logical change per commit
- Never commit `.env`, `downloads/`, or `outputs/`
- Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) format
- This is enforced by `commitlint` via a `commit-msg` husky hook
- Commits that don't match the format will be rejected

### Commit message format

```
<type>(<scope>): <short description>

- <detail 1>
- <detail 2>
```

### Rules

- **type** (required): one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`, `ci`, `build`, `revert`
- **scope** (recommended): kebab-case name of the feature/area, e.g. `release`, `transcript-fetcher`, `llm-analyzer`
- **short description** (required): lowercase, imperative mood, max 100 chars, no period at end
- **body** (optional): pointwise with `-`, max 500 chars total
- Semantic-release uses this format to determine version bumps:
  - `feat` -> minor version bump (1.0.0 -> 1.1.0)
  - `fix` -> patch version bump (1.0.0 -> 1.0.1)
  - `BREAKING CHANGE` in body or `!` after type -> major version bump (1.0.0 -> 2.0.0)

### Examples

```
feat(clip-refiner): add overlap detection for adjacent segments

- detect when refined segments overlap by more than 2s
- merge overlapping segments and keep the higher-scored one
```

```
fix(release): add @semantic-release/npm to update package.json version

- add @semantic-release/npm with npmPublish: false
- npm publish remains a separate workflow step
```

```
docs(readme): add advanced examples section
```
