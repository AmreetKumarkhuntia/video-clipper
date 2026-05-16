---
name: migrate-endpoint-to-sqlite
description: Walk through migrating a single video-clipper API endpoint (or small endpoint group) from JSON-file storage to the SQLite/Drizzle repo layer per docs/plans/sqlite-migration.md. Use this skill once per migration step; it is a checklist, not codegen.
---

# Migrate one endpoint to SQLite

This skill is the repeatable recipe for the persistence refactor planned in `docs/plans/sqlite-migration.md`. Invoke it for **one** endpoint or one tightly-coupled endpoint group at a time. Do not bundle unrelated endpoints — keep each migration small enough to verify end-to-end and commit on its own.

## Inputs

- **endpoint(s)**: the SvelteKit route file(s) under `src/app/web/routes/api/...`. Example: `src/app/web/routes/api/clips/[clipId]/edits/+server.ts`.
- **step number** from the migration order in `docs/plans/sqlite-migration.md` (so we know which tables this step owns and which prior steps should already be done).

If the user didn't say which endpoint, ask. Then re-read `docs/plans/sqlite-migration.md` for the assigned tables before doing anything else.

## Ground rules (do not skip)

- **No JSON fallback.** Don't keep the old file IO behind a flag or as a backup read path.
- **No dual-write.** Writes go to SQLite only.
- **No backfill.** Existing `outputs/web/*.json` files are not migrated. The user has accepted this.
- **No inline types.** Per project rule, every interface/type lives in `src/lib/types/` or `src/app/web/types/`. A PreToolUse hook will block inline declarations. If you need a new type, add it to one of those folders first.
- **Preserve the HTTP contract.** The endpoint's request shape, response shape, status codes, and streaming semantics must be unchanged — repo changes are invisible to the client.
- **Delete what you replace.** If you make a service file empty, delete it. If a helper has no callers, delete it.
- **One commit per step.** Use `refactor(db): migrate <short-name> to sqlite`.

## Step-by-step

### 1. Identify

- Read the endpoint file end-to-end.
- List every entity it reads or writes. Map each to a table from the schema in `docs/plans/sqlite-migration.md`.
- Find current call sites in the web service layer (`src/app/web/lib/services/`). Common suspects:
  - `library/artifactStore.ts`
  - `library/clipEditService.ts`
  - `library/draftService.ts`
  - `youtube/authStore.ts`
  - `config/fileStore.ts`
  - `src/lib/services/cache/*`
- Note any streaming / SSE behavior — you'll need to preserve it.

### 2. Schema

- Open `src/lib/services/db/schema.ts`. Confirm tables and columns for the listed entities exist.
- If anything is missing:
  - Add columns/tables in `schema.ts`.
  - Generate a migration: `pnpm drizzle-kit generate`.
  - Verify the generated SQL in `drizzle/` looks correct (no surprise drops, FKs present, JSON columns are TEXT with default `'{}'` or `NULL` as appropriate).
- Do not alter tables owned by later migration steps — only the ones this step owns.

### 3. Repo

- For each entity, confirm or create `src/lib/services/db/repos/<entity>Repo.ts`.
- Export only the CRUD + query functions the endpoint actually needs right now. Don't pre-build functions for hypothetical future use.
- Reuse the existing ID generators (search `src/app/web/lib/services/library/` for `analysis-${...}`, `clip-${...}`, etc.).
- JSON columns: parse on read with the existing zod schema, stringify on write. If validation fails, throw — never silently coerce.
- Multi-row writes (e.g. analysis + candidates + chunk_evaluations) go through `db.transaction(() => { ... })`.

### 4. Types

- The HTTP response shape must match the existing domain type (e.g. `ClipPlan`, `ClipArtifact`). If the row shape differs, write a translator inside the repo — do not leak row types into the API surface.
- New row types: re-export `InferSelectModel<typeof <table>>` from `src/lib/types/db.ts` with a sensible name.
- Inline `interface` or `type` blocks anywhere outside the canonical type folders will be blocked by the PreToolUse hook. Add to the canonical folder first.

### 5. Service rewrite

- Replace file-IO calls in the relevant web service module with repo calls.
- Preserve the function signature where the endpoint depends on it — the service module is the seam, not the endpoint.
- If the service module ends up with no exports, delete the file. If it still has exports but its file IO helpers are unused, delete the helpers and their imports.

### 6. Endpoint

- Update `+server.ts` to call the rewritten service.
- Verify the response body and status codes are byte-identical to before for normal cases. Test error cases too (404 when not found, 400 on validation).
- For streaming endpoints (e.g. `/api/analysis/transcript`, `/api/publish/drafts/generate`), keep the SSE / chunked-response format unchanged. The repo calls inside the stream can be synchronous.

### 7. Delete old code

- Grep for any remaining references to the JSON path this step replaced (e.g. `outputs/web/analyses`, `outputs/cache/transcripts`). Remove read and write call sites.
- If a `*Store.ts` / `*Service.ts` file is now empty, delete it.
- Remove unused imports and helpers. Don't leave `// removed` comments — just delete the lines.

### 8. Verify

Run each of these and confirm before committing:

- `pnpm dev` boots without error. (If the DB file doesn't exist on first boot, `migrate.ts` should create it — confirm.)
- `pnpm typecheck` is clean.
- Hit the migrated flow through the UI: navigate to the page that uses the endpoint and perform the relevant action.
- `sqlite3 ~/.config/video-clipper/library.sqlite '.tables'` lists the new/affected tables.
- `sqlite3 ~/.config/video-clipper/library.sqlite 'SELECT * FROM <table> LIMIT 5;'` shows the rows you just created.
- `grep -r 'outputs/web/<entity>' src/` returns nothing for the entity owned by this step (unless a later step still uses it).

If verification fails, fix forward — do not re-introduce a JSON fallback to make symptoms go away.

### 9. Commit

- Stage only the files touched by this step (schema, migration, repo, service, endpoint, deletions).
- Single commit: `refactor(db): migrate <endpoint-or-entity-name> to sqlite`.
- Body bullets:
  - Which endpoint(s) migrated.
  - Which table(s) now back them.
  - Which JSON file paths / service files were removed.

## When you finish

Report to the user:

- The endpoint(s) and table(s) covered.
- Anything in `docs/plans/sqlite-migration.md` that turned out to be wrong or missing — update the doc in the same commit if so.
- The next step number from the migration order (so the user can decide whether to continue immediately or stop).

Do not start the next step in the same invocation. The user wants to drive the cadence.
