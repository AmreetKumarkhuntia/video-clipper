# Phase 3 — LLM Analysis

## Goal

Implement the three LLM-powered services — metadata extraction, parallel segment analysis,
and clip boundary refinement — and wire the full pipeline end-to-end in `src/index.ts`.

## Deliverable

```
npx tsx src/index.ts https://youtube.com/watch?v=<id>
```

Prints the final ranked JSON to stdout matching the spec in `docs/plan.md §6`.

---

## Files to Create

### `src/services/metadataExtractor/`

**`index.ts`**
- `extractMetadata(videoId: string): Promise<VideoMetadata>`
- Uses `yt-dlp --dump-json` via `execa`
- Parses stdout JSON to extract: `title`, `duration` (seconds), `formats`
- Throws with reason if `yt-dlp` fails (private video, not found, etc.)

---

### `src/services/llmAnalyzer/`

**`index.ts`**
- `analyzeChunks(chunks: LLMChunk[]): Promise<AnalyzedSegment[]>`
- Sends all chunks to LLM **in parallel** using `Promise.allSettled`
- Each call uses `generateObject` from Vercel AI SDK with `SegmentSchema` (zod)
- `SegmentSchema`: `{ interesting, score, reason, clip_start, clip_end }`
- On per-chunk failure: log `[warn] chunk <i> failed: <reason>`, continue
- Prompt lives in this file (see `docs/plan.md §3 Module 5`)
- Uses `config.LLM_MODEL` and `config.LLM_MAX_RETRIES`

---

### `src/services/clipRefiner/`

**`index.ts`**
- `refineSegments(segments: RankedSegment[], allBlocks: MicroBlock[]): Promise<RankedSegment[]>`
- For each segment, runs a second `generateObject` LLM call to tighten `clip_start`/`clip_end`
- Provides broader transcript context window (±30s around the segment) from `allBlocks`
- `RefinedClipSchema`: `{ clip_start: z.number(), clip_end: z.number() }`
- On failure: log warning, return segment unchanged
- Prompt lives in this file (see `docs/plan.md §3 Module 7`)

---

### `src/index.ts` (full pipeline wire-up)

Replace stub with full pipeline:

```
1. parseUrl(argv[2])                          → videoId
2. extractMetadata(videoId)                   → metadata
3. fetchTranscript(videoId)                   → lines
4. buildMicroBlocks(lines)                    → microBlocks
5. buildLLMChunks(microBlocks)                → chunks
6. analyzeChunks(chunks)                      → analyzed
7. rankSegments(analyzed)                     → ranked
8. refineSegments(ranked, microBlocks)        → refined
9. Print JSON output (plan.md §6 format)
```

Log progress at each step via `log.info`.
Video download and clip generation are behind a `--clip` flag (implemented in Phase 4 — skip for now).

---

## Acceptance Criteria

- [ ] `npm run lint` passes with no type errors
- [ ] Running against a real YouTube URL produces valid ranked JSON output
- [ ] LLM chunk failures are logged as warnings and don't crash the run
- [ ] Refinement failures fall back to unrefined segment (no crash)
- [ ] Output JSON matches the structure in `docs/plan.md §6` exactly
- [ ] No `any` types in any new file
- [ ] `OPENAI_API_KEY` must be set in `.env` for this phase to work

---

## When Done

```
rm docs/phases/phase-3.md
```

Move to `docs/phases/phase-4.md`.
