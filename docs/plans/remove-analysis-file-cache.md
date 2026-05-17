# Remove File-Based Caching from Analysis Layer; DB-First at /analysis Endpoint

> **Status: PARTIAL — codebase does NOT compile.** A previous agent began this refactor and got partway through step 1 of 7 before being asked to hand off. The next agent must finish steps 1.5–8 to restore the build. See "Current state" below for exactly what was already changed.

## Context (why)

Today, `lib/services/analysis/*` writes per-chunk LLM evaluation JSON and per-segment refinement JSON to a `CacheBackend` (FileCacheBackend by default), plus a `manifest.json` of hashes per video. SQLite now persists transcripts and chunks via `chunksRepo`/`videosRepo`, so the file cache duplicates the DB — and the analysis layer shouldn't own its persistence at all.

**Goal:** make `lib/services/analysis/*` pure (analyze chunks, return evaluations, no I/O). Move analysis persistence to the web endpoint, where `/api/analysis/transcript`:

1. Reads existing chunks from the `chunks` table (already set up by `loadOrFetchTranscript`).
2. Streams `chunk_analyzed` immediately for any chunk whose `analysis` column is already populated.
3. Runs `analyzeChunks` only for the unanalyzed subset, updating each DB row as results arrive.
4. Runs ranker + refiner unchanged (refiner is no longer cached — always re-runs).

## Decisions already made with the user

- **CLI is out of scope for caching parity.** The user has separate plans for the CLI. We are _only_ removing the cache wiring from the analysis layer; the CLI must continue to compile and run (it just loses chunk/refinement caching). Audio + transcript caching can stay where they are.
- **Refinement caching is dropped entirely.** No new DB table for refinements; `refineSegments` always re-runs.
- **`noCache` semantics in /analysis:** `noCache=true` → skip DB-first read, re-analyze all chunks, overwrite DB rows. (`noCache=false` is the default — DB-first.)
- **Tests for removed code paths are to be deleted/rewritten** (do not preserve dead behavior).

---

## Current state — exactly what's already done

The previous agent edited these files. Confirm with `git diff` before touching anything.

### Done ✅

- `src/lib/services/analysis/llm/index.ts`
  - `analyzeChunk` no longer takes `cache` or `noCache` — pure function, no cache read/write.
  - `analyzeChunks` signature is now `(chunks, lines, audioEvents, concurrency, opts)`.
  - Removed `CacheBackend` and `formatSeconds` imports.

- `src/lib/services/analysis/refiner/index.ts`
  - `refineSegment(segment, allBlocks, opts)` — `cache`/`noCache` gone, no cache I/O.
  - `refineSegments(segments, allBlocks, concurrency, opts)` — likewise.
  - Removed `CacheBackend` import.

- `src/lib/services/analysis/transcript/detector.ts`
  - `detect(videoId, audioPath)` — no `cache?` param, no cache branch in body.
  - Removed `CacheBackend` import.

- `src/lib/services/analysis/llm/LLMAnalyzer.ts` **(partial)**
  - Constructor no longer takes `cache: CacheBackend`.
  - `analyze()` calls `this.transcriptDetector.detect(opts.videoId, opts.audioPath)` (no cache).
  - `analyze()` calls `analyzeChunks(...)` with the new 5-arg signature.

### NOT done — broken right now ❌

`LLMAnalyzer.refine()` still calls the OLD `refineSegments(rankedSegments, microBlocks, opts.maxParallel, this.cache, opts.noCache, refineOpts)`. **`this.cache` no longer exists and `refineSegments` no longer accepts those args** → type error. This must be fixed as the first thing the next agent does (see Step 1.5).

Everything else listed in the steps below is untouched.

---

## Plan — pick up here

### Step 1.5: Finish LLMAnalyzer.refine()

File: `src/lib/services/analysis/llm/LLMAnalyzer.ts`

```typescript
// Current broken form:
async refine(
  rankedSegments: RankedSegment[],
  microBlocks: MicroBlock[],
  opts: Pick<LLMAnalyzerOpts, 'maxParallel' | 'noCache' | 'requestId' | 'signal'>,
): Promise<RankedSegment[]> {
  // ...
  return refineSegments(
    rankedSegments,
    microBlocks,
    opts.maxParallel,
    this.cache,    // ← does not exist
    opts.noCache,  // ← about to be removed from LLMAnalyzerOpts
    refineOpts,
  );
}
```

Replace with:

```typescript
async refine(
  rankedSegments: RankedSegment[],
  microBlocks: MicroBlock[],
  opts: Pick<LLMAnalyzerOpts, 'maxParallel' | 'requestId' | 'signal'>,
): Promise<RankedSegment[]> {
  // ... same refineOpts construction ...
  return refineSegments(rankedSegments, microBlocks, opts.maxParallel, refineOpts);
}
```

### Step 2: Pipeline stages — drop cache wiring

File: `src/lib/pipeline/stages/segmentAnalyzer.ts`

- `analyzeSegments(videoId, audioPath, audioEvents, cache, opts)` → drop the `cache: Cache` param. In the body:
  - `new LLMAnalyzer(transcriptDetector, opts.model, opts.maxChunks, opts.maxRetries, opts.systemPrompt, opts.llmModel, opts.callbacks)` — no cache arg.
  - `analyzer.analyze({...})` — drop `noCache: opts.noCache` from the opts literal.
- `refineRankedSegments(rankedSegments, microBlocks, cache, opts)` → drop `cache`. In the body, `refineSegments(rankedSegments, microBlocks, opts.maxParallel, {...})` — drop cache + noCache.
- Drop the `'noCache'` literal from the `Pick<SegmentAnalyzerOpts, ...>` in `refineRankedSegments`.
- Drop the `import type { Cache } from '@lib/services/cache/index.js';` line.

### Step 3: CLI runner — drop cache from calls

File: `src/app/cli/pipeline/runner.ts`

- `analyzeSegments(videoId, audioPath, audioEvents, cache, {...})` → drop `cache` (4th arg). Drop `noCache: args.noCache` from the opts literal.
- `refineRankedSegments(rankedSegments, microBlocks, cache, {...})` → drop `cache` (3rd arg). Drop `noCache: args.noCache` from its opts literal.
- **Keep** the `const backend = await createCacheBackend(config, args.noCache); const cache = new Cache(backend);` block — it's still passed into `processAudio(...)` for audio event caching, which is out of scope.
- **Keep** the `finally { await cache.close(); }`.

### Step 4: Opts types — remove noCache

File: `src/lib/types/analyzer.ts`

- Delete `noCache: boolean;` from `LLMAnalyzerOpts` (line 19).

File: wherever `SegmentAnalyzerOpts` lives (grep for it — likely in `src/lib/types/pipeline.ts` since `noCache: boolean;` appears at line 34 there).

- Delete `noCache: boolean;` from `SegmentAnalyzerOpts`.
- **Keep** `noCache: boolean;` in `CliArgs` (`src/lib/types/cli.ts` line 18) — it still controls audio cache in the CLI.

### Step 5: CacheBackend interface + all backends + facade + manifest

File: `src/lib/types/cache.ts`

Delete:

- `readChunk` / `writeChunk` methods from the `CacheBackend` interface.
- `readSegmentRefinement` / `writeSegmentRefinement` methods.
- `SegmentRefinementSchema` and `SegmentRefinement` type (no longer used).
- `VideoCacheManifest` interface.
- `ClearVideoAnalysisResult` interface.
- Now-unused imports: `LLMChunk`, `ChunkEvaluation`.

Keep: transcript methods, audio methods, `close()`, `CacheDocument<T>` (still used by mongo backend).

File: `src/lib/services/cache/cache.ts` (the `Cache` facade)

- Delete the `readChunk`, `writeChunk`, `readSegmentRefinement`, `writeSegmentRefinement` methods.
- Drop the `import { ... computeChunkCacheKey, computeSegmentRefinementCacheKey } from './backends/file.js';` and `import { appendChunkHash, appendSegmentHash } from './manifest.js';` lines.
- Drop the `manifestCacheDir` getter and the `videoId` constructor param **if unused after the deletions** (verify with grep). If keeping the `videoId` param breaks no callers, leave it; otherwise remove it from the constructor (the only caller passing it was the now-rewritten `analysisService.ts`).
- Drop now-unused type imports (`LLMChunk`, `ChunkEvaluation`, `SegmentRefinement`).

File: `src/lib/services/cache/backends/file.ts`

- Delete `chunkPath`, `readChunk`, `writeChunk`, `segmentRefinementPath`, `readSegmentRefinement`, `writeSegmentRefinement` methods.
- Delete `computeChunkCacheKey`, `computeSegmentRefinementCacheKey` exported functions.
- Drop now-unused imports (`ChunkEvaluationSchema`, `SegmentRefinementSchema`, `LLMChunk`, `ChunkEvaluation`, `SegmentRefinement`).
- Keep `computeVideoCacheKey` (used by `manifest.ts` for the transcript path key — although manifest is being trimmed too, double-check).

File: `src/lib/services/cache/backends/disabled.ts`

- Delete `readChunk`, `writeChunk`, `readSegmentRefinement`, `writeSegmentRefinement` no-op methods.
- Drop now-unused imports.

File: `src/lib/services/cache/backends/mongo.ts`

- Delete `chunkKey`, `readChunk`, `writeChunk`, `readSegmentRefinement`, `writeSegmentRefinement` methods.
- Delete the `CHUNKS` and `SEGMENTS` static collection names.
- Drop now-unused imports (`ChunkEvaluationSchema`, `SegmentRefinementSchema`, `LLMChunk`, `ChunkEvaluation`, `SegmentRefinement`).

File: `src/lib/services/cache/manifest.ts`

- Delete `appendChunkHash`, `appendSegmentHash`.
- Delete `clearVideoAnalysisManifest` (or — if you keep it — strip the chunk/segment file-deletion loops; but it's easier to delete since the only caller is the endpoint addressed in Step 6).
- Delete the `VideoCacheManifest` / `ClearVideoAnalysisResult` imports (they're being removed in Step 5 anyway).
- After cleanup, if the file only contains internal helpers with no exports, delete the whole file and remove its import from `src/lib/services/cache/index.ts` if present.

File: `src/lib/types/index.ts`

- Remove the `export { SegmentRefinementSchema } from './cache.js';` line.
- Remove `SegmentRefinement` from the `export type { ... }` line; keep `CacheBackend, CacheDocument`.

File: `src/lib/index.ts`

- Remove `export { SegmentRefinementSchema } from './types/cache.js';` and `export type { SegmentRefinement } from './types/cache.js';`.

### Step 6: Repurpose or delete the analysis-cache clear endpoint

File: `src/app/web/routes/api/cache/videos/[videoId]/analysis/+server.ts`

The current `DELETE /api/cache/videos/[videoId]/analysis` calls `clearVideoAnalysisManifest`. Since file-based analysis cache is gone, change it to clear DB analysis:

```typescript
import type { RequestHandler } from '@sveltejs/kit';
import { errorMessage, jsonError, jsonOk } from '@app/web/lib/services/http/responses.js';
import { clearChunkAnalysis } from '@lib/services/db/repos/chunksRepo.js';
import { log } from '@lib/utils/logger.js';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const videoId = params.videoId ?? '';
  const reqDone = log.request('DELETE', `/api/cache/videos/${videoId}/analysis`, locals.requestId);
  if (!videoId) {
    reqDone(400);
    return jsonError(400, 'Missing videoId.');
  }
  try {
    const cleared = clearChunkAnalysis(videoId);
    reqDone(200);
    return jsonOk({ ok: true, cleared });
  } catch (error) {
    reqDone(500);
    return jsonError(500, 'Failed to clear analysis.', errorMessage(error));
  }
};
```

You'll add `clearChunkAnalysis` in the next step.

### Step 7: chunksRepo — add update helpers

File: `src/lib/services/db/repos/chunksRepo.ts`

Add two functions (using Drizzle's `and` operator):

```typescript
import { and, eq } from 'drizzle-orm';

export function setChunkAnalysisByRange(
  videoId: string,
  start: number,
  end: number,
  analysis: string | null,
  score: number | null,
): void {
  const done = log.dbCalled('setChunkAnalysisByRange', undefined, { videoId, start, end });
  db.update(chunks)
    .set({ analysis, score, updatedAt: Date.now() })
    .where(and(eq(chunks.videoId, videoId), eq(chunks.start, start), eq(chunks.end, end)))
    .run();
  done({});
}

/** Clears analysis + score on every chunk row for a video. Returns row count affected. */
export function clearChunkAnalysis(videoId: string): number {
  const done = log.dbCalled('clearChunkAnalysis', undefined, { videoId });
  const result = db
    .update(chunks)
    .set({ analysis: null, score: null, rank: null, updatedAt: Date.now() })
    .where(eq(chunks.videoId, videoId))
    .run();
  done({});
  return result.changes ?? 0;
}
```

Verify the `and` import is correct against the installed Drizzle version (`pnpm why drizzle-orm`); the import path stays `'drizzle-orm'`.

### Step 8: Rewrite analyzeTranscriptForWeb (DB-first)

File: `src/app/web/lib/services/analysis/analysisService.ts`

Replace the whole `analyzeTranscriptForWeb` function. Reference for shape:

```typescript
import { getModel } from '@lib/utils/modelFactory.js';
import { selectSegments } from '@lib/pipeline/stages/segmentSelector.js';
import { refineRankedSegments } from '@lib/pipeline/stages/segmentAnalyzer.js';
import { analyzeChunks } from '@lib/services/analysis/llm/index.js';
import { loadOrFetchTranscript } from '@app/web/lib/services/analysis/transcriptService.js';
import { findChunks, setChunkAnalysisByRange } from '@lib/services/db/repos/chunksRepo.js';
import { createArtifactId, saveAnalysis } from '@app/web/lib/services/artifacts/artifactStore.js';
import {
  ClipPlanSchema,
  type ClipPlan,
  type CreateAnalysisRequest,
} from '@app/web/types/analysis.js';
import { ChunkEvaluationSchema } from '@lib/types/index.js'; // verify exact export path
import type {
  ChunkEvaluation,
  LLMChunk,
  RankedSegment,
  StreamCallbacks,
  TranscriptLine,
} from '@lib/types/index.js';
import type { AnalyzeChunksOpts } from '@lib/types/analyzer.js';
import type { Config } from '@lib/types/config.js';

export async function analyzeTranscriptForWeb(
  input: CreateAnalysisRequest,
  cfg: Config,
  callbacks?: StreamCallbacks,
  requestId?: string,
  signal?: AbortSignal,
): Promise<ClipPlan> {
  const { lines, microBlocks, chunks } = await loadOrFetchTranscript(input.videoId, cfg);

  // Build prompt + model (same as today — copy the existing buildAnalysisSystemPrompt usage).
  const model = getModel(cfg.LLM_PROVIDER, cfg.LLM_MODEL, {
    /* keys */
  });
  const basePrompt = cfg.LLM_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = cfg.LLM_SYSTEM_PROMPT
    ? basePrompt
    : buildAnalysisSystemPrompt(basePrompt, input.title, input.channelTitle, input.description);

  // 1. Bucket chunks: cached-in-DB vs needs-analysis
  const dbRows = findChunks(input.videoId);
  const rowByRange = new Map<string, (typeof dbRows)[number]>();
  for (const row of dbRows) rowByRange.set(`${row.start}|${row.end}`, row);

  const chunkEvals: ChunkEvaluation[] = new Array(chunks.length);
  const toAnalyze: Array<{ chunk: LLMChunk; originalIndex: number }> = [];
  const noCache = input.options.noCache;

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const row = rowByRange.get(`${c.start}|${c.end}`);
    if (!noCache && row?.analysis) {
      const parsed = ChunkEvaluationSchema.safeParse(JSON.parse(row.analysis));
      if (parsed.success && parsed.data.status === 'success') {
        chunkEvals[i] = parsed.data;
        callbacks?.onChunkStarted?.(i);
        callbacks?.onChunkAnalyzed?.(i, parsed.data);
        continue;
      }
    }
    toAnalyze.push({ chunk: c, originalIndex: i });
  }

  // 2. Analyze the misses with wrapped callbacks (re-map local→original index + persist)
  if (toAnalyze.length > 0) {
    const wrapped: StreamCallbacks = {
      onChunkStarted: (local) => callbacks?.onChunkStarted?.(toAnalyze[local].originalIndex),
      onChunkTextDelta: (local, text) =>
        callbacks?.onChunkTextDelta?.(toAnalyze[local].originalIndex, text),
      onChunkAnalyzed: (local, evaluation) => {
        const originalIndex = toAnalyze[local].originalIndex;
        const chunk = toAnalyze[local].chunk;
        chunkEvals[originalIndex] = evaluation;
        setChunkAnalysisByRange(
          input.videoId,
          chunk.start,
          chunk.end,
          JSON.stringify(evaluation),
          evaluation.status === 'success' ? evaluation.score : null,
        );
        callbacks?.onChunkAnalyzed?.(originalIndex, evaluation);
      },
    };

    const analyzeOpts: AnalyzeChunksOpts = {
      maxRetries: cfg.LLM_MAX_RETRIES,
      systemPrompt,
      model,
      requestId,
      signal,
      callbacks: wrapped,
    };

    await analyzeChunks(
      toAnalyze.map((x) => x.chunk),
      lines,
      [], // audioEvents — web path does not compute audio events here
      input.options.maxParallel ?? DEFAULT_WEB_LLM_CONCURRENCY,
      analyzeOpts,
    );
  }

  // 3. Ranker (unchanged)
  const rankedSegments = selectSegments(chunkEvals, [], {
    threshold: input.options.threshold ?? cfg.SCORE_THRESHOLD,
    topN: input.options.topN ?? cfg.TOP_N_SEGMENTS,
    boostWindow: cfg.AUDIO_LLM_BOOST_WINDOW,
    scoreBoost: cfg.AUDIO_LLM_SCORE_BOOST,
    preRoll: cfg.AUDIO_CLIP_PRE_ROLL,
    postRoll: cfg.AUDIO_CLIP_POST_ROLL,
  });

  // 4. Refiner (no cache, no noCache)
  const finalSegments =
    input.options.refine && rankedSegments.length > 0
      ? await refineRankedSegments(rankedSegments, microBlocks, {
          maxParallel: input.options.maxParallel ?? DEFAULT_WEB_LLM_CONCURRENCY,
          maxRetries: cfg.LLM_MAX_RETRIES,
          model,
          requestId,
          videoTitle: input.title,
          callbacks,
          signal,
        })
      : rankedSegments;

  // 5. Build + save plan (unchanged shape)
  const createdAt = new Date().toISOString();
  const plan = ClipPlanSchema.parse({
    id: createArtifactId(`analysis-${input.videoId}`),
    videoId: input.videoId,
    title: input.title ?? input.videoId,
    durationSec: input.durationSec ?? 0,
    candidates: finalSegments.map((segment) => toClipCandidate(input.videoId, segment, lines)),
    chunkEvaluations: chunkEvals,
    createdAt,
  });

  return saveAnalysis(plan, cfg.OUTPUT_DIR);
}
```

Notes:

- Drop `createCacheBackend`/`Cache`/`videoIdFrom`/`finally { cache.close() }`. No cache backend is created in this path at all.
- `videoIdFrom(input)` was just `input.videoId` — inline it.
- Confirm the exact import path for `ChunkEvaluationSchema` — it's in `src/lib/types/segment.ts` and re-exported by `src/lib/types/index.ts`.
- `audioEvents` is passed as `[]` because the web path never computed them today either (the old code passed `[]` to `analyzeSegments`).
- Keep `buildAnalysisSystemPrompt`, `toClipCandidate`, `excerptForSegment`, `DEFAULT_SYSTEM_PROMPT` helpers — they don't change.

File: `src/app/web/routes/api/analysis/transcript/+server.ts`

**No changes needed.** It already forwards callbacks; the DB-first behaviour is opaque to it.

### Step 9: Update tests

The previous agent surveyed tests but did not edit them. Three test files break:

1. `tests/cache.test.ts`
   - Delete the entire `describe('chunk evaluations', ...)` block (≈ lines 96–129).
   - Inside `describe('disabled cache', ...)` delete the test `it('returns null for chunk reads', ...)` (≈ lines 180–183).
   - The transcript + audio describe blocks stay.

2. `tests/mongoCacheBackend.test.ts`
   - Delete the chunk evaluation describe block (the `readChunk`/`writeChunk` cases) and the segment refinement describe block (the `readSegmentRefinement`/`writeSegmentRefinement` cases) — together that's roughly the lines around `readChunk` / `readSegmentRefinement` references (use the grep output from the survey to locate exactly).
   - Delete the `SegmentRefinement` import line.
   - Delete the `SEGMENT_REFINEMENT` fixture.

3. `tests/llmAnalyzer.test.ts`
   - `makeAnalyzer` constructor call must drop the `cache` argument: `new LLMAnalyzer(detector, makeModel(), undefined, 3, 'default prompt', 'test-model')`.
   - Delete the `makeCache` helper.
   - Test `'passes videoId, audioPath, and cache to transcriptDetector.detect'` (≈ line 135): rename to "passes videoId and audioPath to transcriptDetector.detect" and change the assertion to `expect(detector.detect).toHaveBeenCalledWith('vid-xyz', '/tmp/audio.wav')` (no third arg).
   - Test `'forwards audioEvents and noCache to analyzeChunks'` (≈ line 156): drop `noCache` from the title and the assertion (which currently expects 7 args incl. cache + `true`); the new assertion is `expect(analyzeChunks).toHaveBeenCalledWith(CHUNKS, LINES, audioEvents, 1, expect.objectContaining({ maxRetries: 3, systemPrompt: 'default prompt' }))`.
   - All `analyze({...})` calls: drop the `noCache: true|false` field from the opts literal.
   - All `refine([...], MICRO_BLOCKS, { maxParallel: X, noCache: Y })` calls: drop the `noCache` field.
   - Test `'passes segments, microBlocks, maxParallel and noCache to refineSegments'` (≈ line 280): rename without `noCache`; assertion becomes `expect(refineSegments).toHaveBeenCalledWith([RANKED_SEGMENT], MICRO_BLOCKS, 4, expect.objectContaining({ maxRetries: 3 }))`.

4. `tests/transcriptDetector.test.ts`
   - The `detect()` signature lost the third `cache` arg. Two paths:
     - **Preferred:** Delete the `describe('detect — cache-first behaviour', ...)` block entirely (cache is no longer the detector's responsibility).
     - Update every `detector.detect('abc123', null, cache)` call to `detector.detect('abc123', null)` and drop assertions about `cache.writeTranscript`/`cache.readTranscript`.
   - Either way, the `makeCache` helper becomes unused and should be deleted.

### Step 10: Verify

Run both type-check passes from the repo root:

```bash
pnpm run web:check          # web + lib
pnpm run check              # CLI
pnpm test                   # unit tests
```

Iterate on any callers the previous survey missed. Likely candidates that may surface:

- Re-exports from `src/lib/index.ts` or `src/lib/types/index.ts` of removed symbols (`SegmentRefinement`, `SegmentRefinementSchema`).
- Any importer of `appendChunkHash` / `appendSegmentHash` / `clearVideoAnalysisManifest` other than the endpoint addressed in Step 6.
- Mongo backend may have `CHUNKS`/`SEGMENTS` constant references in tests not yet removed.

### Step 11: Manual smoke test (post-build)

1. `pnpm run web` → open a video page → trigger analysis. First run: all chunks analyzed via LLM, each `chunk_analyzed` event arrives; DB `chunks.analysis` + `chunks.score` populated.
2. Trigger analysis again on the same video → all chunks emit `chunk_analyzed` immediately from DB (no LLM calls); `analysis_complete` arrives fast.
3. Trigger with `noCache=true` → all chunks re-analyzed via LLM; DB rows overwritten.
4. `DELETE /api/videos/[id]/transcript` then re-trigger → fresh transcript fetch, fresh chunks, fresh analysis.
5. Verify no new files appear under `<CACHE_DIR>/chunks/` or `<CACHE_DIR>/segments/` during/after a run.

---

## Critical files (quick reference)

| Concern                            | Path                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Analysis layer (already cleaned)   | `src/lib/services/analysis/{llm,refiner,transcript}/...`                                                                  |
| LLMAnalyzer (partial — fix refine) | `src/lib/services/analysis/llm/LLMAnalyzer.ts`                                                                            |
| Pipeline stages                    | `src/lib/pipeline/stages/segmentAnalyzer.ts`                                                                              |
| CLI runner                         | `src/app/cli/pipeline/runner.ts`                                                                                          |
| Cache interface                    | `src/lib/types/cache.ts`                                                                                                  |
| Cache facade                       | `src/lib/services/cache/cache.ts`                                                                                         |
| Cache backends                     | `src/lib/services/cache/backends/{file,disabled,mongo}.ts`                                                                |
| Cache manifest                     | `src/lib/services/cache/manifest.ts`                                                                                      |
| Type re-exports                    | `src/lib/types/index.ts`, `src/lib/index.ts`                                                                              |
| Opts types                         | `src/lib/types/analyzer.ts`, `src/lib/types/pipeline.ts`                                                                  |
| DB repo                            | `src/lib/services/db/repos/chunksRepo.ts`                                                                                 |
| Web service (full rewrite)         | `src/app/web/lib/services/analysis/analysisService.ts`                                                                    |
| Endpoint (repurpose)               | `src/app/web/routes/api/cache/videos/[videoId]/analysis/+server.ts`                                                       |
| Tests                              | `tests/cache.test.ts`, `tests/mongoCacheBackend.test.ts`, `tests/llmAnalyzer.test.ts`, `tests/transcriptDetector.test.ts` |
