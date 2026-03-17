# Refactor Phases

This document records the three-phase refactor of `video-clipper` from a
monolithic `run()` function in `src/index.ts` into a clean, layered
pipeline architecture.

---

## Goals

- Make each pipeline concern independently testable and readable
- Eliminate the `run()` god-function (574 lines → ~40 lines in `index.ts`)
- Enable true parallelism between LLM analysis (pass 1) and audio detection
- Introduce a typed `Cache` class injected top-down, replacing ad-hoc free functions
- Extract CLI parsing into its own module for reuse and testability

---

## Phase 1 — Shared Utilities

**Files created:**

| File                   | Purpose                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `src/utils/cache.ts`   | Refactored: `Cache` class + `@deprecated` legacy free-function shims                   |
| `src/utils/chunker.ts` | New: `buildWindows(totalDuration, windowSec, overlapSec?)` generic time-window builder |
| `src/cli.ts`           | New: `CliArgs`, `parseArgs()`, `printUsage()` extracted from `index.ts`                |

**Key decisions:**

- `Cache` is constructed once per run in `runner.ts` and injected into every
  stage that needs caching. `disabled = true` short-circuits all I/O
  (replaces the `--no-cache` ad-hoc scattered checks).
- The legacy free-function shims (`readTranscriptCache`, `writeChunkCache`,
  etc.) delegate to `new Cache(cacheDir)` so `llmAnalyzer` and `clipRefiner`
  compile with zero changes.
- `buildWindows` replaces the manual `for (offset += chunkLength)` loop that
  was inline in `run()` and is now shared by `audioProcessor`.

**Gate:** `npm run build` clean, all 50 existing tests green.

---

## Phase 2 — Pipeline Stages

**Files created under `src/pipeline/`:**

| File                            | Stage        | Wraps                                                                    |
| ------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `stages/videoResolver.ts`       | 1            | `urlParser` + `metadataExtractor`                                        |
| `stages/transcriptProcessor.ts` | 2            | `transcriptFetcher` + `chunkBuilder` + `dumper`                          |
| `stages/audioProcessor.ts`      | 3            | `audioDownloader` + `audioEventDetector` + `sliceAudio` + `buildWindows` |
| `stages/segmentAnalyzer.ts`     | 4a + 4b      | `llmAnalyzer` (pass 1) + `clipRefiner` (pass 2)                          |
| `stages/segmentSelector.ts`     | 5            | `signalMerger` + `segmentRanker`                                         |
| `stages/clipExporter.ts`        | 6            | `videoDownloader` + `clipGenerator`                                      |
| `runner.ts`                     | Orchestrator | Composes all six stages                                                  |

**Parallelism gain:**
`analyzeSegments` (LLM pass 1) and `processAudio` now run concurrently via
`Promise.all` in `runner.ts`. They are fully independent — audio detection
only needs the video duration (from stage 1 metadata).

```
Stage 1  ──► videoResolver
Stage 2  ──► transcriptProcessor
         ┌── analyzeSegments  (LLM pass 1)  ─┐
Stage 3+4a   processAudio                    │  Promise.all
         └────────────────────────────────────┘
Stage 5  ──► selectSegments   (merge + rank)
Stage 4b ──► refineRankedSegments  (LLM pass 2)
Stage 6  ──► exportClips      (optional, --clip)
```

**Clip export modes** handled by `clipExporter`:

1. `--local-video` — cut directly with ffmpeg, no download
2. `--download-sections N` — download top-N clips via yt-dlp `--download-sections`, organize to outputs/
3. Default / `--download-sections all` — download full video, cut with ffmpeg

**Gate:** `npm run build` clean, all 50 existing tests green.

---

## Phase 3 — Slim Entrypoint + New Tests

**Files changed / created:**

| File                     | Change                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `src/index.ts`           | Replaced 574-line god-function with ~40-line entrypoint delegating to `runPipeline()` |
| `tests/chunker.test.ts`  | 14 unit tests for `buildWindows` (edge cases, overlaps, clipping)                     |
| `tests/cache.test.ts`    | 16 unit tests for `Cache` class (round-trips, misses, disabled mode, corrupt data)    |
| `docs/refactorPhases.md` | This file                                                                             |

**`src/index.ts` now:**

1. Parses CLI args via `parseArgs`
2. Validates required args and prints usage on error
3. Calls `runPipeline(args)` and catches any thrown error → `log.error` + `process.exit(1)`

All error handling that previously used `process.exit(1)` inline inside
`run()` now propagates as thrown `Error` objects from the stages, keeping
the pipeline stages pure (no direct `process.exit` calls).

**Gate:** `npm run build` clean, all 80 tests green (50 original + 14 chunker + 16 cache).
