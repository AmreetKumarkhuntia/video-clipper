# Agent Instructions

## Project

TypeScript CLI that analyzes YouTube transcripts with an LLM to find interesting moments and optionally cut video clips.

See `docs/plan.md` for the full architecture.

## Stack

- TypeScript (Node.js 18+)
- Vercel AI SDK (`ai`, `@ai-sdk/openai`) with `generateObject` + `zod` for structured LLM output
- `youtube-transcript` for transcript fetching
- `yt-dlp` + `execa` for video download
- `fluent-ffmpeg` for clip cutting
- `zod` for config validation at startup

## Project Structure

```
src/
  config.ts        # zod-validated env config — import this, never read process.env directly
  modules/
    urlParser.ts
    metadataExtractor.ts
    transcriptFetcher.ts
    chunkBuilder.ts
    llmAnalyzer.ts
    segmentRanker.ts
    clipRefiner.ts
    videoDownloader.ts
    clipGenerator.ts
  types.ts         # shared TypeScript types
  index.ts         # CLI entrypoint
downloads/         # yt-dlp output (gitignored)
outputs/           # ffmpeg clip output (gitignored)
docs/
  plan.md
```

## Code Rules

- All code in TypeScript — no plain `.js` files
- Every function must have explicit input/output types; avoid `any`
- Use `zod` for all external data validation (LLM output, env vars, API responses)
- Never read `process.env` directly — always import from `src/config.ts`
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

Each module in `src/modules/` should:
- Export a single main function named after the module (e.g. `fetchTranscript`, `buildChunks`)
- Accept typed inputs and return typed outputs (no `any`)
- Not import from other modules except `config.ts` and `types.ts` unless there is a clear dependency

## Transcript Notes

- `youtube-transcript` returns `offset` in **milliseconds** — normalize to seconds immediately after fetching
- Micro-blocks group raw lines into ~15s windows before chunking
- LLM chunks are 120s windows with 20s overlap — built from micro-blocks, not raw lines

## Naming

- Files: `camelCase.ts`
- Functions: `camelCase`
- Types/interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Zod schemas: `PascalCase` + `Schema` suffix (e.g. `SegmentSchema`)

## Testing

- Write unit tests for pure functions (URL parser, chunker, ranker, deduplicator)
- Do not unit test functions that call external services (LLM, yt-dlp, ffmpeg) — integration test those separately
- Test files live next to source files: `urlParser.test.ts` alongside `urlParser.ts`

## Git

- Commit messages: lowercase, imperative
- One logical change per commit
- Never commit `.env`, `downloads/`, or `outputs/`
- It should be pointwise `-`
- Shouldn't be more than 500 characters all together
- it should be categorized as feat: , fix:, docs:, refactor etc...
- also it should include specifics like feat(<feature>)
- so final structure is <change ex: feat, docs, fix>: <short desc> followed by <full desc> pointwise