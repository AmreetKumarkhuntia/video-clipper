# CLI Subcommands

## Overview

Replaced the monolithic single-command CLI with a subcommand-based interface that shares the same SQLite database as the web app.

## Commands

| Command      | Usage                                                  | Description                                                |
| ------------ | ------------------------------------------------------ | ---------------------------------------------------------- |
| `analyze`    | `video-clipper analyze <url> [opts]`                   | Fetch transcript, run LLM analysis, persist ClipPlan to DB |
| `clip`       | `video-clipper clip <analysisId> [opts]`               | Generate MP4 clips for an analysis's candidates            |
| `candidates` | `video-clipper candidates <analysisId> [--json]`       | List ranked candidates for a saved analysis                |
| `library`    | `video-clipper library [--analyses\|--clips] [--json]` | Browse saved analyses and clips                            |
| `channel`    | `video-clipper channel <handle/url> [--json]`          | Resolve YouTube channel, list recent videos                |
| `config`     | `video-clipper config [key] [value]`                   | View/set config values                                     |
| `run`        | `video-clipper run <url> [all existing flags]`         | Legacy one-shot pipeline (backward compat)                 |

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
