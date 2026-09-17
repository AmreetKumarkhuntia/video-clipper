# PostgreSQL-Only Backend Migration

> **Status: IMPLEMENTED** — PostgreSQL replaces SQLite as the backend's only database. This is a
> greenfield cutover: no SQLite data import, compatibility adapter, fallback, or dual-write path is
> shipped.

## Decisions

- The backend uses `pg.Pool` through Drizzle's `node-postgres` adapter.
- `DATABASE_URL` is a required environment-only deployment secret. It is not part of mutable app
  settings and must never be logged or returned by the settings API.
- The operator runs `pnpm db:migrate` before starting a new API release. API replicas never run
  migrations at startup.
- The PostgreSQL baseline uses native `timestamptz`, `jsonb`, `boolean`, `double precision`, and
  foreign-key constraints. Repositories preserve the existing HTTP/domain representations.
- PostgreSQL 17 is the local-development and CI baseline.
- Once PostgreSQL accepts writes, rollback uses a PostgreSQL backup and compatible application
  release. SQLite is not a rollback target.

## Implementation order

1. Add PostgreSQL dependencies, environment validation, pool lifecycle, and CI services.
2. Replace the SQLite schema and migration history with one PostgreSQL baseline migration.
3. Convert repositories and their API/orchestration callers to awaited asynchronous operations.
4. Port integration and CLI-login browser tests to isolated PostgreSQL schemas.
5. Remove every active SQLite dependency, configuration key, fixture, script, and instruction.
6. Verify builds, all test tiers, the standalone CLI boundary, and a fresh migration.

## Local development

```bash
pnpm db:migrate
pnpm api:dev
pnpm web:dev
```

Provision PostgreSQL 17 before running these commands. The default development URL is documented in
`.env.example`. Tests require a separate `TEST_DATABASE_URL`; they never fall back to the
development or production URL.

## Deployment and recovery

Run `pnpm db:migrate` once as a release step, then start API replicas. Back up PostgreSQL with
`pg_dump` and restore with `pg_restore`; preserve `TOKEN_ENCRYPTION_KEY` with the database backup
because provider tokens cannot be recovered without the matching key.

## Completion gate

- A fresh PostgreSQL database migrates and seeds both roles.
- Repository, API, orchestration, architecture, and browser tests run against PostgreSQL.
- The API fails before listening when PostgreSQL is unavailable or behind the expected migration.
- The CLI package remains database-free.
- `pnpm why better-sqlite3` reports no installed dependency.
