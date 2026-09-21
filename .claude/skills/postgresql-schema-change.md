---
name: postgresql-schema-change
description: Safely change the video-clipper PostgreSQL schema, repositories, migrations, and isolated database tests without introducing startup migrations or SQLite compatibility.
---

# Change the PostgreSQL schema

Use this checklist for one cohesive persistence change. Read
`docs/plans/postgresql-migration.md` and the affected repository functions before editing.

## Invariants

- PostgreSQL is the only backend database. Do not add a file-database fallback, compatibility
  adapter, dual-write path, or legacy-data import.
- `DATABASE_URL` and pool settings are restart-only environment values. Never add them to the
  mutable/public settings schema.
- The API checks migration state but never applies migrations. Operators run `pnpm db:migrate`
  before starting a new release.
- The backend owns the pool. The web app and standalone CLI stay database-free.
- Preserve HTTP and domain contracts. Translate PostgreSQL `Date` and JSONB values inside repos,
  validating JSONB with the owning Zod schema.
- Repository functions are asynchronous. Multi-statement replacements and dependent writes use
  `withDbTransaction`.
- Keep synchronous SSE callbacks free of persistence; persist completed LLM-stage results in an
  awaited batch.

## Procedure

1. Update `src/lib/services/db/schema.ts` using native PostgreSQL types and explicit foreign-key
   lifecycle actions. Add indexes for real query paths and retain existing uniqueness rules.
2. Run `pnpm db:generate`, review every generated statement, and run `pnpm db:check`. Never edit an
   already-deployed migration; add a new one.
3. Update the owning repo under `src/lib/services/db/repos/`. Use `returning()` when behavior depends
   on affected rows, and batch inserts rather than issuing one query per item.
4. Propagate `await` through orchestration and API consumers. Keep the CLI behind its HTTP client.
5. Add integration coverage through `tests/support/postgres.ts`. Each file gets private application
   and migration-ledger schemas; tests never fall back from `TEST_DATABASE_URL` to `DATABASE_URL`.
6. Verify foreign-key actions, rollback behavior, JSONB/time translation, concurrency when a unique
   claim is involved, and migration behavior on an empty database.
7. Run `pnpm type-check`, `pnpm format:check`, the relevant test layers, `pnpm db:check`, and the
   affected builds. Run the whole verification matrix before merging a baseline or cross-cutting
   change.

## Operator handoff

Call out the required `pnpm db:migrate` release step, backup implications, and whether the change is
backward compatible with the currently deployed application. PostgreSQL backups use `pg_dump` and
`pg_restore`; the matching `TOKEN_ENCRYPTION_KEY` must be preserved separately.
