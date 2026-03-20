# Agent Instructions

## Project

TypeScript CLI that analyzes YouTube transcripts with an LLM to find interesting moments and optionally cut video clips.

See `docs/plan.md` for the full architecture.

## Stack

- TypeScript (Node.js 18+)
- Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/xai`, `@ai-sdk/mistral`, `@ai-sdk/groq`) with `generateObject` + `zod` for structured LLM output
- Multi-provider support: OpenAI, Anthropic, Google, XAI, Mistral, Groq, Zai, OpenRouter
- `youtube-transcript` for transcript fetching
- `yt-dlp` + `execa` for video download
- `fluent-ffmpeg` for clip cutting
- `zod` for config validation at startup
- `p-limit` for concurrency control

## Project Structure

```
src/
  config/          # zod-validated env config — import this, never read process.env directly
    index.ts
    env.ts
  services/        # core pipeline modules
    urlParser/
    metadataExtractor/
    transcriptFetcher/
    chunkBuilder/
    llmAnalyzer/
    segmentRanker/
    clipRefiner/
    videoDownloader/
    clipGenerator/
  types/           # shared TypeScript types
    index.ts
    config.ts
    segment.ts
    transcript.ts
    video.ts
    youtube-transcript.d.ts
  utils/           # utility functions
    cache.ts        # transcript + chunk LLM result caching
    dumper.ts       # transcript/analysis JSON dumps
    redactConfig.ts # config formatting for logs (redacts API keys)
    format.ts       # timestamp formatting utilities
    logger.ts       # logging utilities
    modelFactory.ts # LLM provider factory
  index.ts         # CLI entrypoint
tests/             # all unit tests (mirrors module names)
  urlParser.test.ts
  chunkBuilder.test.ts
  segmentRanker.test.ts
downloads/         # yt-dlp output (gitignored)
outputs/           # ffmpeg clip output, caches, dumps (gitignored)
  cache/           # transcript + LLM result cache
  transcript/       # transcript dumps
  analysis/        # analysis dumps
docs/
  plan.md
  free-models.md
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
- Test files live in `tests/` at the project root, mirroring the module name (e.g. `tests/urlParser.test.ts`)

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
