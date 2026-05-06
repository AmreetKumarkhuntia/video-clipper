# Agent Instructions

## Project

TypeScript CLI + Web app that analyzes YouTube transcripts with an LLM to find interesting moments and optionally cut video clips.

See `docs/plan.md` for the full architecture.

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

Only 3 aliases — everything flows through `@lib`:

| Alias        | Resolves To     | Purpose                                                               |
| ------------ | --------------- | --------------------------------------------------------------------- |
| `@lib/*`     | `src/lib/*`     | Core library (types, config, utils, services, shared pipeline stages) |
| `@app/cli/*` | `src/app/cli/*` | CLI application                                                       |
| `@app/web/*` | `src/app/web/*` | Web application (SvelteKit)                                           |

Same-directory imports (`./foo.js`) stay relative. All `.js` extensions are required (NodeNext).

## Project Structure

```
src/
  lib/                        # Core library — source of truth
    index.ts                  # Public API barrel (re-exports shared code only)
    types/                    # Shared types (13 files)
      index.ts, config.ts, transcript.ts, segment.ts, audio.ts,
      video.ts, cli.ts, pipeline.ts, analyzer.ts, downloader.ts,
      cache.ts, factory.ts, youtube.ts
    config/                   # Shared config
      env.ts                  # zod-validated env — import this, never read process.env
      index.ts                # re-exports config
    utils/                    # Shared utilities
      logger.ts, format.ts, paths.ts, pythonBin.ts, chunker.ts,
      modelFactory.ts, cacheBackend.ts, cache.ts, cacheFactory.ts,
      fileCacheBackend.ts, mongoCacheBackend.ts
    services/                 # Core services (shared: CLI + web)
      urlParser/
      metadataExtractor/
      chunkBuilder/
      llmAnalyzer/
      segmentRanker/
      clipRefiner/
      transcriptDetector/
      transcriptAnalyzers/
      audioDownloader/
      audioAnalyzers/
      eventDetector/
      videoDownloader/
      clipGenerator/
      youtube/
    pipeline/stages/          # Shared pipeline stages (used by both CLI and web)
      segmentAnalyzer.ts      # LLM analysis + transcript detection
      segmentSelector.ts      # Segment ranking + selection
      clipExporter.ts         # Video download + clip generation

  app/
    cli/                      # CLI application
      index.ts                # CLI entrypoint (shebang)
      args.ts                 # parseArgs + printUsage
      pipeline/
        runner.ts             # Full CLI pipeline orchestration
        dumper.ts             # Transcript/analysis JSON dumps
        stages/
          videoResolver.ts    # CLI-only: URL parsing + yt-dlp metadata
          audioProcessor.ts   # CLI-only: audio download + event detection

    web/                      # Web application (SvelteKit)
      app.html                # SvelteKit HTML template
      style/                  # Global styles (CSS custom properties, reset, typography)
        variables.css         # Design tokens (colors, radii, spacing, fonts)
        reset.css             # Global resets (box-sizing, body, button/input inherit)
        typography.css        # .eyebrow, .muted, .error-text utility classes
        index.css             # @import barrel
      components/             # Reusable UI components (each with scoped <style>)
        Button.svelte         # primary/outline variants, disabled state
        ErrorText.svelte      # error message display
        MutedText.svelte      # muted/disabled text
        PageHead.svelte       # eyebrow + heading + action slot
        Pagination.svelte     # prev/next pager
        ChannelCard.svelte    # channel thumbnail + title + link
        VideoCard.svelte      # video thumbnail + duration + title
        CandidateCard.svelte  # clip candidate with checkbox + score
        YouTubeEmbed.svelte   # responsive 16:9 iframe
      lib/                    # SvelteKit $lib
        index.ts              # app name etc.
        api.ts                # readApiError(), apiFetch<T>()
        format.ts             # formatDuration(), formatTime()
        services/             # Web server logic
          analysis/           # Analysis orchestration for web
          clipping/           # Clip generation for web
          artifacts/          # File persistence for web
          youtube/            # YouTube API factory for web
          config/             # Web-specific config adapter
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

```
app/cli/  ──imports──>  src/lib/
app/web/  ──imports──>  src/lib/  +  app/web/ (internal)
src/lib/  ──imports──>  (external packages only)
```

- **CLI code** (`src/app/cli/`) never imports from `src/app/web/`
- **Web code** (`src/app/web/`) imports from `src/lib/` and internal web modules
- **Library code** (`src/lib/`) never imports from `src/app/`
- **Web types** (`src/app/web/types/`) are separate from shared types (`src/lib/types/`)

## Code Rules

- All code in TypeScript — no plain `.js` files
- Every function must have explicit input/output types; avoid `any`
- Use `zod` for all external data validation (LLM output, env vars, API responses)
- Never read `process.env` directly — always import from `@lib/config/index.js`
- Never hardcode API keys, model names, thresholds, or directory paths — all come from config
- Use `async/await` — no raw `.then()` chains
- Use `Promise.allSettled` for parallel LLM calls so one failure doesn't abort the rest
- Handle errors explicitly — no silent catches. Log a warning with the chunk index and reason on skip.

## LLM Usage

- Use `generateObject` (not `generateText`) for all LLM calls that return structured data
- Define a `zod` schema for every LLM response before writing the prompt
- Keep prompts in the same file as the function that uses them
- Do not retry on malformed JSON — `generateObject` handles structured output natively
- On any LLM call failure, catch and log, then continue — never crash the pipeline

## Module Conventions

Each service module in `src/lib/services/` should:

- Export a single main function named after the module (e.g. `parseUrl`, `buildChunks`)
- Accept typed inputs and return typed outputs (no `any`)
- Not import from other modules except `@lib/config/*`, `@lib/types/*`, and `@lib/utils/*` unless there is a clear dependency

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
