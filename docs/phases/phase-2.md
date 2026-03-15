# Phase 2 — Pure Data Pipeline + Tests

## Goal

Implement the pure/testable data pipeline services — URL parsing, transcript fetching,
chunk building, and segment ranking — with full unit test coverage on all pure functions.

## Deliverable

```
npm test
```

All unit tests pass. Running the CLI fetches a real transcript and prints chunked output.

---

## Files to Create

### `src/services/urlParser/`

**`index.ts`**
- `parseUrl(url: string): string` — extracts and returns the 11-char `videoId`
- Supports `youtube.com/watch?v=` and `youtu.be/` formats
- Throws a clear `Error` on invalid input or wrong-length ID

**`index.test.ts`**
- Valid `youtube.com/watch?v=` URL → correct videoId
- Valid `youtu.be/` URL → correct videoId
- Invalid URL → throws
- Video ID not 11 chars → throws
- URL with extra query params → still parses correctly

---

### `src/services/transcriptFetcher/`

**`index.ts`**
- `fetchTranscript(videoId: string): Promise<TranscriptLine[]>`
- Uses `youtube-transcript` package
- Normalizes `offset` (ms) → `start` (seconds) immediately after fetch
- Normalizes `duration` (ms) → seconds
- Throws with message `"No transcript found for this video"` if unavailable

---

### `src/services/chunkBuilder/`

**`index.ts`**
- `buildMicroBlocks(lines: TranscriptLine[], windowSec?: number): MicroBlock[]`
  - Groups raw lines into ~`MICRO_BLOCK_SEC` windows (default from config)
  - Each block: `{ start, end, text }`
- `buildLLMChunks(blocks: MicroBlock[], chunkSec?: number, overlapSec?: number): LLMChunk[]`
  - Groups micro-blocks into larger windows (`CHUNK_LENGTH_SEC` with `CHUNK_OVERLAP_SEC` overlap)
  - Each chunk: `{ start, end, text }`

**`index.test.ts`**
- `buildMicroBlocks`: empty input → `[]`
- `buildMicroBlocks`: lines spanning 60s → correct number of blocks
- `buildMicroBlocks`: all text within window is concatenated
- `buildLLMChunks`: correct chunk count for given duration
- `buildLLMChunks`: overlap windows contain correct start/end
- `buildLLMChunks`: single block → single chunk

---

### `src/services/segmentRanker/`

**`index.ts`**
- `rankSegments(segments: AnalyzedSegment[], threshold?: number, topN?: number): RankedSegment[]`
  - Filters by `score >= threshold` (default from config)
  - Deduplicates overlapping segments (>50% overlap → keep higher score)
  - Sorts by `score DESC`
  - Keeps top `N` (default from config)
  - Assigns `rank` starting at 1

**`index.test.ts`**
- Filters out segments below threshold
- Deduplicates: two overlapping segments → keeps higher score
- Deduplicates: two non-overlapping segments → keeps both
- Returns correct `rank` values
- Respects `topN` limit
- Empty input → `[]`

---

## Acceptance Criteria

- [ ] `npm test` passes all unit tests with no failures
- [ ] `npm run lint` still passes (no new type errors)
- [ ] `npx tsx src/index.ts <real_youtube_url>` fetches a transcript and logs chunk count
- [ ] `transcriptFetcher` normalizes `offset` to seconds (verified via log output)
- [ ] No `any` types in any new file

---

## When Done

```
rm docs/phases/phase-2.md
```

Move to `docs/phases/phase-3.md`.
