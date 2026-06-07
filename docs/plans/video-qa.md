# Feature: Ask About the Video (Transcript-grounded Q&A)

## Context

Today the repo only analyzes a video to find clip candidates: fetch transcript → chunk → per-chunk LLM scoring → rank → refine. There is no way to simply _ask a question_ about the video.

This feature adds a **multi-turn Q&A** capability: a user types a question, we ground the LLM in the video's transcript (sent whole, with timestamps), and stream back an answer. Answers cite moments inline as `[mm:ss]`, which the UI renders as **clickable timestamps** that seek the player — tying Q&A naturally into the existing clip workflow. Conversation history is kept (multi-turn) and persisted per video so follow-ups have context and survive reloads.

Decisions confirmed with the user:

- **Retrieval:** whole timestamped transcript in one prompt (no retrieval layer yet).
- **Conversation:** multi-turn chat with persisted history.
- **Surfaces:** Web UI + CLI.
- **Citations:** inline `[mm:ss]` markers rendered as clickable seek links, plus the answer text.

## Reuse (don't reinvent)

- `loadOrFetchTranscript(videoId, cfg)` — `src/lib/orchestration/transcriptOrchestrator.ts`. Returns `TranscriptBundle` (cached in DB + rebuilt microblocks/chunks). Use as-is for transcript loading.
- `Model` class — `src/lib/services/modelFactory/index.ts`. `Model.streamText(opts)` accepts `system` + `messages` (ModelStreamTextOpts = full `streamText` params minus model). Build the model exactly as `runAnalysis` does in `analysisOrchestrator.ts:88-97`.
- Transcript-context line format: copy the `[${l.start.toFixed(1)}s] ${l.text}` join from `buildPrompt` in `src/lib/services/analysis/llm/index.ts:94-97`.
- Title/channel/description prefix: mirror `buildAnalysisSystemPrompt` in `analysisOrchestrator.ts:34-52`.
- SSE server pattern: `src/app/web/routes/api/analysis/transcript/+server.ts` (ReadableStream + `serializeSSE`).
- SSE client pattern: `src/app/web/lib/analysisStream.ts` (`createParser`, abort handling).
- Web service delegation: `src/app/web/lib/services/analysis/analysisService.ts`.
- CLI command shape: `src/app/cli/commands/analyze.ts` (`parseUrl`, `extractMetadata`, `upsertVideo`, arg parsing, `CommandHandler`).
- Existing player seek: `+page.svelte` already has `let seekToSec = $state<number>()` bound to `YouTubeEmbed` — the Q&A panel emits seeks through this.
- UI primitives: `Button`, `Textarea`, `Card`, `Badge`, `Icon` in `src/app/web/components/`.

## Implementation

### 1. Types (canonical type folders only — no inline types)

- **`src/lib/types/qa.ts`** (new). Zod schemas + inferred types:
  - `QaCitation` `{ label: string; timeSec: number }`
  - `QaRole` = `'user' | 'assistant'`
  - `QaMessage` `{ id; role; content; citations: QaCitation[]; createdAt }`
  - `QaRequest` `{ videoId; question; history: QaMessage[]; title?; channelTitle?; description? }`
  - `QaAnswer` `{ messageId; content; citations: QaCitation[] }`
  - Export all from `src/lib/types/index.ts` barrel.
- **`src/app/web/types/qa.ts`** (new): re-export backend QA types; add `QaStreamCallbacks` (`onStarted`, `onProgress(text)`, `onComplete(answer)`, `onError`) and `QaStreamEventName` (`'qa_started' | 'qa_progress' | 'qa_complete' | 'error'`). Add `VideoQaPanelProps` etc. to `src/app/web/types/componentProps.ts`.

### 2. Prompt

- `src/lib/services/analysis/prompts.ts`: add `DEFAULT_QA_SYSTEM_PROMPT`. Instructs: answer **only** from the transcript; say when the transcript doesn't cover it; cite supporting moments inline as `[mm:ss]` (or `[h:mm:ss]`) using the timestamps shown. Make it overridable via a new `cfg.LLM_QA_SYSTEM_PROMPT` (add to config schema/registry with the others).

### 3. QA service — `src/lib/services/analysis/qa/index.ts` (new)

- `buildTranscriptContext(lines)` → timestamped transcript block (reuse line format above).
- `parseCitations(text)` → scan answer for `[mm:ss]`/`[h:mm:ss]`, convert to `{ label, timeSec }`, dedupe.
- `answerQuestion({ bundle, question, history, title, channelTitle, description, model, systemPrompt, callbacks, signal, requestId })`:
  - `system` = title/channel/description prefix + QA instructions + transcript context.
  - `messages` = mapped `history` (role/content) + final user `question`.
  - `model.streamText({ system, messages, abortSignal })`; iterate `fullStream`, forward `text-delta` via `callbacks.onProgress`, accumulate full text.
  - Return `QaAnswer { messageId, content, citations: parseCitations(content) }`.

### 4. DB persistence (multi-turn)

- `src/lib/services/db/schema.ts`: new `qa_messages` table `{ id (pk), videoId (indexed), role, content, citations (json text), createdAt }`.
- `src/lib/services/db/migrate.ts`: include new table.
- `src/lib/services/db/repos/qaMessagesRepo.ts` (new): `findQaMessages(videoId)`, `insertQaMessage(videoId, msg)`, `clearQaMessages(videoId)`.

### 5. Orchestrator — `src/lib/orchestration/qaOrchestrator.ts` (new)

- `answerVideoQuestion(input: QaRequest, cfg, callbacks?, requestId?, signal?): Promise<QaAnswer>`:
  - Build `Model` (same as `runAnalysis`).
  - `bundle = await loadOrFetchTranscript(input.videoId, cfg)`.
  - `systemPrompt = cfg.LLM_QA_SYSTEM_PROMPT ?? DEFAULT_QA_SYSTEM_PROMPT`.
  - Persist the user turn, call `answerQuestion`, persist the assistant turn (with citations).
  - Return the `QaAnswer`.
- Export from `src/lib/orchestration/index.ts`.

### 6. Web API

- **POST `src/app/web/routes/api/analysis/qa/+server.ts`** (new): parse `QaRequestSchema`, open SSE `ReadableStream`, wire callbacks → `qa_started`/`qa_progress`/`qa_complete`/`error` (mirror transcript route + `serializeSSE`; extend the event-name handling in `streamEvents.ts` or add a small qa equivalent).
- **`src/app/web/routes/api/videos/[videoId]/qa/+server.ts`** (new): `GET` → existing thread via `findQaMessages`; `DELETE` → `clearQaMessages` (mirrors transcript route).
- `src/app/web/lib/services/analysis/qaService.ts` (new): `answerVideoQuestionForWeb(...)` → delegates to `answerVideoQuestion`; thin reads for thread.

### 7. Web client + widget

- `src/app/web/lib/qaStream.ts` (new): mirror `analysisStream.ts`; POST to `/api/analysis/qa`, parse qa events, resolve `QaAnswer`.
- `src/app/web/widgets/video/analysis/VideoQaPanel.svelte` (new, domain widget): scrollable message list (one `Card` per turn), `Textarea` + `Button` ("Ask"/"Stop"), streaming assistant bubble, "Clear chat". Render answer text splitting on `[mm:ss]` markers into clickable timestamp links; clicking calls `onSeek(timeSec)`. Props: `videoId`, `transcriptReady`, `onSeek`.
- Wire into `src/app/web/routes/videos/[videoId]/+page.svelte`: render `VideoQaPanel` (gated on transcript loaded), pass `onSeek={(s) => (seekToSec = s)}` to reuse the existing player seek. Load existing thread on mount via the GET route.

### 8. CLI

- `src/app/cli/commands/ask.ts` (new): `video-clipper ask <youtube-url> "<question>" [--reset]`. Resolve via `parseUrl`/`extractMetadata`/`upsertVideo`, load prior thread (unless `--reset` → `clearQaMessages`), call `answerVideoQuestion` with a streaming callback that prints deltas, then print citations as `[mm:ss]` list. Each invocation appends to the persisted thread → consecutive `ask` calls form a conversation.
- Register `['ask', askCommand]` in `src/app/cli/commands/index.ts`; add `AskArgs` to `src/lib/types/command.ts`.

## Notes / risks

- Whole-transcript context can exceed the window on very long videos. Acceptable for v1; the QA service is structured so a relevance pre-filter over `microBlocks` can slot in later without changing callers.
- Inline-marker citations keep answers fully streamable (no second structured pass). The parser tolerates `mm:ss` and `h:mm:ss`.

## Verification

1. **Build/typecheck:** `npm run build` / `tsc` (and the PreToolUse inline-type hook stays green — all types in `src/lib/types/` & `src/app/web/types/`).
2. **CLI:** `video-clipper ask "<youtube-url>" "What is the main argument?"` → streamed answer with `[mm:ss]` citations; run a second `ask` with a follow-up ("and what example did they give?") to confirm history is used; `--reset` clears it. Verify a `qa_messages` row exists in the SQLite library DB.
3. **Web:** start the SvelteKit app, open `/videos/<id>`, load transcript, ask a question in the Q&A panel → tokens stream in; click a `[mm:ss]` link → player seeks (via `seekToSec`); reload page → thread persists; "Clear chat" empties it.
4. **Edge cases:** ask something not in the transcript → model declines gracefully; abort mid-stream (Stop) closes the SSE without an error toast (mirror transcript abort handling).
