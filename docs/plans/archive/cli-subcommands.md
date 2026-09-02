# CLI Subcommands

> **Status: DONE** — every command below shipped in `cbb1c98`; `ask` was added afterwards by the video-qa work (`8f8cf98`), and `run` was consolidated onto the shared orchestration layer in `005e572`.

## Overview

Replaced the monolithic single-command CLI with a subcommand-based interface that shares the same SQLite database as the web app.

## Commands

| Command      | Usage                                                  | Description                                                    |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------------- |
| `analyze`    | `video-clipper analyze <url> [opts]`                   | Fetch transcript, run LLM analysis, persist ClipPlan to DB     |
| `clip`       | `video-clipper clip <analysisId> [opts]`               | Generate MP4 clips for an analysis's candidates                |
| `candidates` | `video-clipper candidates <analysisId> [--json]`       | List ranked candidates for a saved analysis                    |
| `library`    | `video-clipper library [--analyses\|--clips] [--json]` | Browse saved analyses and clips                                |
| `channel`    | `video-clipper channel <handle/url> [--json]`          | Resolve YouTube channel, list recent videos                    |
| `ask`        | `video-clipper ask <url> "<question>" [--reset]`       | Ask questions about a video; conversation persisted in DB      |
| `config`     | `video-clipper config [key] [value]`                   | View/set config values                                         |
| `run`        | `video-clipper run <url> [all existing flags]`         | One-shot analyze (+ optional `--clip`) on shared orchestration |

Bare URL without subcommand routes to `run` for backward compatibility.

## Architecture

### Shared orchestration layer (`src/lib/orchestration/`)

Extracted DB-backed orchestration from `src/app/web/lib/services/` into shared library modules:

- `transcriptOrchestrator.ts` — DB-first transcript loading with fetch fallback
- `analysisOrchestrator.ts` — Full analysis with chunk/segmentation caching
- `clipOrchestrator.ts` — Clip generation with DB persistence

Both web and CLI import from this shared layer.

### Shared types (`src/lib/types/analysis.ts`)

Moved `ClipPlan`, `ClipCandidate`, `TranscriptBundle`, etc. from `src/app/web/types/analysis.ts` into `src/lib/types/analysis.ts` to fix boundary violations where `src/lib/` was importing from `src/app/web/`.
