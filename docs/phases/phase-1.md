# Phase 1 — Scaffolding + Core Infrastructure

## Goal

Bootstrap the project so `npx tsx src/index.ts <url>` runs without crashing, with all
dependencies installed, TypeScript configured, and the config/types/utils layers in place.

## Deliverable

```
npx tsx src/index.ts https://youtube.com/watch?v=dQw4w9WgXcQ
```

Prints:

```
[info] Starting video-clipper for dQw4w9WgXcQ...
[info] Pipeline not yet implemented.
```

Missing `OPENAI_API_KEY` exits immediately with a clear zod validation error.

---

## Files to Create

### `package.json`
- `"type": "module"`
- Production deps: `ai`, `@ai-sdk/openai`, `youtube-transcript`, `execa`, `fluent-ffmpeg`, `zod`, `dotenv`
- Dev deps: `typescript`, `tsx`, `@types/node`, `@types/fluent-ffmpeg`, `vitest`
- Scripts: `start`, `build`, `test`, `test:watch`, `lint`

### `tsconfig.json`
- `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`
- `strict: true`, `esModuleInterop: true`, `resolveJsonModule: true`
- `rootDir: src`, `outDir: dist`

### `.gitignore`
- `node_modules/`, `dist/`, `downloads/`, `outputs/`, `.env`, `*.mp4`, `*.m4a`, `*.webm`

### `.env.example`
- All config keys with defaults (see `docs/plan.md §5`)

### `src/config/schema.ts`
- Zod `ConfigSchema` — all env vars with coerced defaults
- Export the inferred `Config` type

### `src/config/env.ts`
- Call `dotenv.config()` at top
- Parse `process.env` through `ConfigSchema`
- Exit with clear message on validation failure

### `src/config/index.ts`
- Re-export `config` from `env.ts`

### `src/types/transcript.ts`
- `TranscriptLine`, `MicroBlock`, `LLMChunk`

### `src/types/segment.ts`
- `AnalyzedSegment`, `RankedSegment`

### `src/types/video.ts`
- `VideoMetadata`, `PipelineResult`

### `src/types/index.ts`
- Re-exports all types

### `src/utils/logger.ts`
- `log.info(msg)`, `log.warn(msg)`, `log.error(msg)` — prefixed with `[info]` / `[warn]` / `[error]`

### `src/utils/format.ts`
- `formatSeconds(s: number): string` — converts seconds to `HH:MM:SS`

### `src/index.ts`
- Read URL from `process.argv[2]`, print usage error if missing
- Import `config` (triggers validation)
- Print stub message with videoId placeholder
- All service imports stubbed as comments

### `downloads/.gitkeep`, `outputs/.gitkeep`
- Empty files to track directories in git

---

## Acceptance Criteria

- [ ] `npm install` completes with no errors
- [ ] `npm run lint` (`tsc --noEmit`) passes with zero errors
- [ ] `npx tsx src/index.ts https://youtube.com/watch?v=dQw4w9WgXcQ` prints stub output
- [ ] `npx tsx src/index.ts` (no URL) prints usage error
- [ ] Running without `OPENAI_API_KEY` exits with a clear zod error
- [ ] `npm test` runs vitest with 0 test files (passes vacuously)

---

## When Done

```
rm docs/phases/phase-1.md
```

Move to `docs/phases/phase-2.md`.
