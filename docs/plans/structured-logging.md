# Structured Logging Plan

## Goal

Add `log.fnCalled` / `log.fnResult` (via a `done` closure) and `log.request` / `log.response`
(via a `done` closure) to the shared logger. Apply them to key service entry points and all
web API route handlers.

## New Logger API

### `log.fnCalled(name, meta?)` → `done(result?)`

Logs function entry with optional key/value metadata. Returns a `done` closure that logs
the exit line and elapsed time when called.

```
[fn →] analyzeChunks chunks=10 concurrency=3
[fn ←] analyzeChunks succeeded=8 total=10 (2341ms)
```

### `log.request(method, path)` → `done(status)`

Logs an incoming HTTP request. Returns a `done` closure that logs the response status and
elapsed time when called.

```
[req] POST /api/analysis/transcript
[res] POST /api/analysis/transcript 200 (1234ms)
```

## Files Changed

### `src/lib/utils/logger.ts`

Add private `formatMeta(meta)` helper and two new methods on `log`:

| Method                  | Returns                 | Logs                                                 |
| ----------------------- | ----------------------- | ---------------------------------------------------- |
| `fnCalled(name, meta?)` | `done(result?) => void` | `[fn →]` on call, `[fn ←]` + duration on done        |
| `request(method, path)` | `done(status) => void`  | `[req]` on call, `[res]` + status + duration on done |

### Service / Pipeline Functions

| File                                         | Function               | Entry meta                | Exit meta            |
| -------------------------------------------- | ---------------------- | ------------------------- | -------------------- |
| `src/lib/services/analysis/llm/index.ts`     | `analyzeChunks`        | `chunks`, `concurrency`   | `succeeded`, `total` |
| `src/lib/services/analysis/refiner/index.ts` | `refineSegments`       | `segments`, `concurrency` | `refined`            |
| `src/lib/pipeline/stages/segmentAnalyzer.ts` | `analyzeSegments`      | `videoId`                 | _(empty)_            |
| `src/lib/pipeline/stages/segmentAnalyzer.ts` | `refineRankedSegments` | `segments`                | _(empty)_            |

### Web API Routes

All 8 handlers get `log.request` at the top and `reqDone(status)` before every return.

| Route file                                           | Method | Path string logged                         |
| ---------------------------------------------------- | ------ | ------------------------------------------ |
| `api/analysis/transcript/+server.ts`                 | POST   | `/api/analysis/transcript`                 |
| `api/clips/+server.ts`                               | POST   | `/api/clips`                               |
| `api/library/clips/+server.ts`                       | GET    | `/api/library/clips`                       |
| `api/library/analyses/+server.ts`                    | GET    | `/api/library/analyses`                    |
| `api/youtube/videos/[videoId]/transcript/+server.ts` | GET    | `/api/youtube/videos/[videoId]/transcript` |
| `api/youtube/videos/[videoId]/+server.ts`            | GET    | `/api/youtube/videos/[videoId]`            |
| `api/youtube/channels/resolve/+server.ts`            | GET    | `/api/youtube/channels/resolve`            |
| `api/youtube/channels/[channelId]/videos/+server.ts` | GET    | `/api/youtube/channels/[channelId]/videos` |

**SSE route note:** `reqDone(400)`/`reqDone(500)` on early parse errors; `reqDone(200)` just
before `return new Response(stream, ...)` since the HTTP 200 is sent at stream open.

## Implementation Steps

1. Update `src/lib/utils/logger.ts` — add `formatMeta`, `fnCalled`, `request`
2. Update `src/lib/services/analysis/llm/index.ts` — wrap `analyzeChunks`
3. Update `src/lib/services/analysis/refiner/index.ts` — wrap `refineSegments`
4. Update `src/lib/pipeline/stages/segmentAnalyzer.ts` — wrap both stage functions
5. Update all 8 web API route handlers — add request/response logging
6. Run `tsc --noEmit` and verify 0 errors
