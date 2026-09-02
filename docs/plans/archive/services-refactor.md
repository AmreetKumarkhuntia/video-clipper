# Services-Independence Refactor

> **Status: DONE** — all phases landed (each as one commit, independently green: tsc + 253 vitest tests + svelte-check). Extras beyond the original plan: a constants-consolidation pass (duplicated default prompts, OAuth cookie names, sanitizeLogValue) and removal of the dead `PipelineResult` type. The architecture rules below are enforced by `tests/serviceBoundaries.test.ts`.

## Context (why)

Goal: every service (yt/video, audio, analysis, publish, db, modelFactory) should be **independently importable by both the web app and the CLI** — a consumer pulls one service through one entry point without dragging in the rest of the pipeline.

The yt service is the partially-done exemplar. Already landed:

- `9e7ab6f` — domain tree `services/{audio,analysis,video}` with barrels
- `7948d01` — config DI: **zero `@lib/config` imports under `services/`**; services take narrow typed config objects (`DownloaderConfig`, `ClipperConfig`, `TranscriptChainConfig`, …) assembled by callers
- `cbb1c98` — shared `orchestration/` layer used by both CLI subcommands and web

Decisions made with the user:

- **Consolidate the legacy CLI `run` pipeline** (`src/app/cli/pipeline/runner.ts`) onto shared orchestration and **delete `services/cache`** — finishes [sqlite-migration.md](../sqlite-migration.md) step 10.
- **No npm subpath exports** for now (deferred; boundaries first).
- Logger singleton stays as-is (out of scope).
- Types stay centralized in `src/lib/types/` / `src/app/web/types/` (hook-enforced; per-service co-located types were deliberately reversed in `51aca58` — do not re-attempt).

## Verified layering

```
Layer 0 — foundation libs (only npm + types + utils)
  services/modelFactory: Model (generateText/streamText/generateJSON/streamJSON,
    wraps Vercel AI SDK via providers.ts), AudioModel, defineTool   ← "the models lib"
  utils (logger, retryAsync, pythonBin, paths→scripts/*.py) · types (contracts)

Layer 1 — analyzer families (derive from abstract bases; sit on Layer 0)
  audio/analyzer:    AudioAnalyzer base → GeminiAudioAnalyzer (composes `new Model()`),
                     WhisperAudioAnalyzer (Python), YAMNetAudioAnalyzer (Python)
  audio/transcriber: TranscriptAnalyzer base → YtDlpTranscriptAnalyzer (misfiled in
                     video/subtitles.ts today = the audio⇄video cycle; Phase 2 moves it
                     home), WhisperTranscriptAnalyzer (Python),
                     GeminiTranscriptAnalyzer (STUB — detect() throws)
  analysis:          composition not inheritance — LLMAnalyzer (injected Model +
                     TranscriptDetector), qa (injected Model), refiner (defineTool),
                     ranker (pure)

Layer 2 — chains/detectors: createAnalyzerChain, createTranscriptChain (fallback
  chains over Layer 1), TranscriptDetector (chain + chunker)

Layer 3 — pipeline stages + orchestration: construct Model from Config, wire chains,
  own db. (`new Model` sites: 2 orchestrators = correct; gemini analyzer = internal OK;
  CLI runner → dies Phase 7; web metadataService + subtitlePlanService → lib in Phase 5.)

Layer 4 — apps (CLI commands, web routes) assemble Config, call orchestrators.
```

Rules the architecture test (Phase 4) encodes:

- `types/` is a **leaf** — imports nothing from `@lib`/`@app`
- `src/lib` never imports `@app/*`
- Cross-service edges allowed: `* → modelFactory` (everything may build on the models lib) and `audio → video` (ytdlp transcriber consumes yt caption functions as a library)
- Outside consumers import service **values** only via `@lib/services/<svc>/index.js`; **types** only via `@lib/types/*`; intra-service imports stay relative
- Only `orchestration/` touches `services/db`
- `services/`, `orchestration/`, `pipeline/` never import `@lib/config` — config is injected

## What blocks independence today (all verified against code)

1. **audio ⇄ video cycle** — `video/source/youtube/subtitles.ts:8` imports audio's `TranscriptAnalyzer` base (`YtDlpTranscriptAnalyzer` lives at the bottom of subtitles.ts); `audio/transcriber/factory.ts:3` imports it back.
2. **lib→app violation** — `db/repos/{publishDrafts,uploadArtifacts}Repo.ts` import `@app/web/types/publish.js`.
3. **types→services inversion** — `types/pipeline.ts:5` + `types/analyzer.ts:4` import `Model` from `services/modelFactory`.
4. **db singleton** — `db/client.ts` opens SQLite at import (env read, mkdirSync, WAL); `migrate.ts` resolves `drizzle/` from `process.cwd()`.
5. **~1,200 lines of business logic stranded in `src/app/web/lib/services/`** (upload, OAuth, LLM metadata, subtitle planning, clip-edit) — no web-framework deps, unreachable from CLI; `uploadAuth.ts` is the only lib-pattern violator reading the config singleton.
6. **Dead facades** — every service barrel has zero importers; ~44 deep-import lines across ~28 files.

## Phases

### ☑ Phase 1 — make `src/lib/types/` a true leaf

- `types/modelFactory.ts`: add `export interface Model` mirroring the class (`generateText`/`streamText`/`generateJSON`/`streamJSON`; return types via `ReturnType<typeof generateText>` etc. — file already imports from `ai`).
- `services/modelFactory/model.ts`: `export class Model implements ModelContract` (aliased type import). Fallback if generics fight: drop `implements`, rely on structural typing.
- Rewire `Model` type imports: `types/pipeline.ts`, `types/analyzer.ts` → `./modelFactory.js`; `services/analysis/llm/LLMAnalyzer.ts`, `services/analysis/qa/index.ts` → `@lib/types/modelFactory.js`.
- `types/transcript.ts`: add `TranscriptProvider` interface; `services/analysis/transcript/detector.ts` uses it instead of audio's base class (kills the analysis→audio edge).
- Invariant: `grep -rn "@lib/services" src/lib/types/` empty.

Commit: `refactor(types): make lib types a leaf module`

### ☑ Phase 2 — break audio ⇄ video cycle (yt exemplar complete)

- Create `services/audio/transcriber/ytdlp.ts`: move `YtDlpTranscriptAnalyzer` verbatim; extends `./base.js`; calls `fetchTranscript` from `@lib/services/video/index.js`.
- `subtitles.ts`: delete the audio import + class; **export** `fetchTranscript` (currently private).
- `audio/transcriber/factory.ts` → `./ytdlp.js`.
- Barrels: audio adds `YtDlpTranscriptAnalyzer`; video drops it, adds `fetchTranscript` + `fetchAvailableCaptionTracks`.
- `tests/analyzerFactory.test.ts` → new path.
- Result: video imports nothing from other services; `audio → video` is the one documented edge.

Commit: `refactor(audio-transcriber): move ytdlp analyzer into audio service to break audio-video cycle`

### ☑ Phase 3 — move publish + subtitle-plan types to lib

- Create `src/lib/types/publish.ts`: move lib-grade contents of `web/types/publish.ts` (PublishDraft/Item, UploadArtifact(+Status), PublishPrivacyStatus, YOUTUBE_CATEGORIES, GeneratedPublishMetadata, YouTubeChannel/AuthState/AuthStatus, OAuthCookieState, CachedMetadata, all schemas) + `UploadDraftClipsCallbacks` from `web/types/upload.ts`.
- `web/types/publish.ts` keeps web-only types (PublishDraftItemEvent, UploadQueueStatus, ListUploadsQuerySchema, DraftParamsSchema) and re-exports the moved ones from lib (pattern: `web/types/analysis.ts`) — web consumers need zero edits.
- Create `src/lib/types/subtitlePlan.ts` (move whole file; web file becomes re-export shim).
- Fix violation: `db/repos/publishDraftsRepo.ts`, `uploadArtifactsRepo.ts` → `@lib/types/publish.js`. Update `types/index.ts`.
- Invariant: `grep -rn "@app/" src/lib/` empty, permanently.

Commit: `refactor(types): move publish and subtitle-plan domain types from web to lib`

### ☑ Phase 4 — barrel convention + consumer rewrites + enforcement

- Create `services/db/index.ts` barrel (runMigrations + all repo functions; do NOT export `db`/client).
- Complete barrels vs real call sites: video adds `remuxClips`, `renderClipWithEdits`; analysis adds `answerQuestion` (qa) + prompts.
- Rewrite ~44 deep-import lines / ~28 files (orchestrators, pipeline stages, CLI commands, web routes/services, `src/hooks.server.ts`). Type-only imports (`YtDlpCookies`, `TranscriptChainConfig`, `ClipperConfig`, …) → `@lib/types/*`. Rewrite `app/cli/pipeline/runner.ts` mechanically too (dies in Phase 7).
- Create `tests/serviceBoundaries.test.ts` (fs-walk + import-regex) enforcing the rules listed under "Verified layering".

Commit: `refactor(services): route all service imports through service barrels and enforce boundaries`

### ☑ Phase 5a — publish stack moves to lib

- `utils/paths.ts`: add `getUserConfigDir()`; `config/fileStore.ts` reuses it.
- `types/publish.ts`: add `YouTubeOAuthClientConfig { clientId?, clientSecret?, redirectUri? }`.
- Create `services/publish/`: `authStore.ts`, `oauth.ts` (from `uploadAuth.ts` — config singleton removed; every function takes `oauth: YouTubeOAuthClientConfig`), `uploadClient.ts` (pure YouTube API HTTP), `metadata.ts` + `metadataCache.ts` (kept — plain fs cache, unrelated to the deleted cache service), `index.ts`.
- Create `utils/ids.ts` (`createArtifactId` out of analysisOrchestrator; orchestrator re-exports).
- Create `orchestration/publishOrchestrator.ts`: draft build/load/save (from draftService) + `uploadDraftClips(input, cfg, requestId?, callbacks?)` (from uploadService), via db barrel.
- Web: `webConfig.ts` adds `toYouTubeOAuthConfig(cfg)`; rewrite ~10 consumers (5 auth routes, 3 draft routes, uploads route, analysis layout.server); delete the 6 moved web files; trim `artifactStore.ts`; `web/types/upload.ts` re-exports callbacks from lib.

Commit: `refactor(publish): move publish services and orchestration into lib`

### ☑ Phase 5b — clip-edit orchestrator + subtitle planner

- Create `orchestration/clipEditOrchestrator.ts` (from web clipEditService: computeEditsHash/loadClipEdits/saveClipEdits/renderEditedClip; renderer via video barrel, clips via db barrel).
- Create `services/analysis/subtitlePlanner.ts` (from web subtitlePlanService; export via analysis barrel).
- Rewrite 3 routes (`clips/[clipId]/{edits,render,subtitles/plan}`); fix `tests/subtitlePlanNormalize.test.ts` import; delete the 2 web files.

Commit: `refactor(clip-edit): move clip edit orchestration and subtitle planner into lib`

### ☑ Phase 6 — db lazy init + migration path

- `db/client.ts`: `initDb(path?)` / `getDb()` lazy; keep `export const db` as a `Proxy` delegating to `getDb()` (binds methods) — zero repo churn; existing `vi.mock('...client.js', ...)` in tests keeps working.
- `utils/paths.ts`: fix `PACKAGE_ROOT` to 3 levels up (currently 2 — latent bug: resolves to `src/`/`dist/`, breaking `scriptPath()` for the Python scripts too).
- `db/migrate.ts`: `runMigrations(folder = join(PACKAGE_ROOT, 'drizzle'))`, use `getDb()`. package.json `files` += `"drizzle"`.
- db barrel exports `initDb`, `getDb`.

Commit: `refactor(db): lazy database initialization and package-root migration path`

### ☑ Phase 7 — `run` consolidation + cache deletion (BREAKING; only behavior-changing phase)

- `types/analysis.ts`: `CreateClipsRequestSchema` gains optional `options { localVideo?, videoPath?, downloadSections? }`; `clipOrchestrator.ts` threads them into `exportClips`; `commands/clip.ts` passes its already-parsed flags (fixes existing dead flags).
- Rewrite `commands/run.ts` (self-contained): parseUrl/extractMetadata → max-duration guard → upsertVideo → `runAnalysis` → optional `--output-json` (now a ClipPlan) → if `--clip`, `generateClipsForAnalysis` with options → summaries. `--no-audio`/`--game-profile` → deprecation warn, ignored.
- Delete: `app/cli/pipeline/{runner.ts,dumper.ts,stages/audioProcessor.ts,stages/videoResolver.ts}`, `services/cache/**`, `types/cache.ts`, `tests/{cache,mongoCacheBackend}.test.ts`.
- Cleanup: `types/index.ts` (CacheBackend/CacheDocument), `lib/index.ts` cache exports + dead `AudioProcessorOpts`, `types/pipeline.ts` dead types, `types/config.ts` (CACHE*BACKEND, MONGODB*\*, CACHE_TTL_SECONDS, mongo superRefine, cache CONFIG_GROUP + FIELD_META, DUMP_OUTPUTS; **keep CACHE_DIR** — publish metadataCache uses it), web settings `groupConfig.ts` cache group, `tests/setup.ts` env keys, package.json drop `mongodb`.
- Behavior changes (BREAKING CHANGE commit body): run loses audio-event detection; `--no-cache` now = analyze semantics (DB transcript reused); `--output-json` emits ClipPlan not PipelineResult; CACHE*\*/MONGODB*\*/DUMP_OUTPUTS env removed; `Cache`/`createCacheBackend`/`CacheBackend` gone from the public barrel. Upside: run results persist to the library DB. semantic-release will major-bump on merge — intended.

Commit: `feat(run)!: consolidate run command onto shared orchestration and remove cache service`

### ☑ Phase 8 — truthful public barrel + docs

- Rewrite `src/lib/index.ts`: source from service barrels; add orchestration layer, qa, publish, clipEdit, db API (`runMigrations`/`initDb`/`getDb`/repos), `YtDlpTranscriptAnalyzer`, caption/transcript fns, `renderClipWithEdits`, `planSubtitles`.
- `README.md`: replace fictional `runPipeline/parseArgs` example with the real API; fix dead `src/lib.ts` link.
- `AGENTS.md`: replace stale pre-`9e7ab6f` structure block with the real tree; document dependency rules (types leaf, only orchestration touches db, allowed edges, barrel convention, config DI rule superseding the old "services may import @lib/config" line); mention `tests/serviceBoundaries.test.ts`.
- Tick [sqlite-migration.md](../sqlite-migration.md) step 10 + this doc's statuses.

Commits: `refactor(lib): export the real programmatic api from the public barrel` → `docs(agents): sync project structure, boundaries, and import conventions`

## Verification (every phase)

```bash
npx tsc --project tsconfig.test.json --noEmit
npx vitest run            # 274 green today; +1 file Phase 4, −2 files Phase 7
pnpm web:check            # when web files touched
```

- After Phase 4 the architecture test locks every later phase.
- Phase 5a has no test coverage: smoke via `pnpm web:dev` → `/api/youtube/auth/status`, load a publish draft.
- Phase 7: manual `run` smoke + `analyze`/`clip` regression; confirm `library` shows the run's analysis.
- End-to-end: `pnpm build`, then import the dist barrel resolves.
