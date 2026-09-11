# Test suite

Tests are grouped by the boundary they exercise, then mirror the source tree. A test belongs at the
lowest level that can prove the behavior reliably.

| Directory       | Use it for                                                                             | External boundaries                                               |
| --------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `unit/`         | Deterministic module behavior, validation, transformations, and local failure handling | Providers/processes mocked; throwaway local files allowed         |
| `integration/`  | Contracts across API, CLI, database, and orchestration modules                         | Local database/HTTP allowed; providers and media processes mocked |
| `architecture/` | Static dependency rules and repository layout                                          | None                                                              |
| `e2e/`          | User-visible browser journeys                                                          | Local fixture services                                            |
| `support/`      | Shared setup, fixtures, and test-model helpers                                         | Not collected directly                                            |

## What deserves a test

Prefer coverage for:

- business rules and security/ownership boundaries;
- parsing and validation at the edges of the system;
- failure isolation, recovery, and idempotency;
- persisted state transitions and cross-module contracts;
- safeguards around fragile media-tool arguments and output caching;
- a small number of critical browser journeys.

Avoid exact duplicates, permutations that exercise the same branch, assertions on private
implementation details, and live calls to LLM providers, YouTube, OAuth providers, yt-dlp, or
ffmpeg. Add an integration test only when a unit test cannot establish the contract.

## Commands

```bash
pnpm test:unit          # isolated behavior
pnpm test:integration   # API, CLI, database, and orchestration contracts
pnpm test:architecture  # dependency and layout rules
pnpm test               # all Vitest projects
pnpm test:e2e           # Playwright browser journeys
pnpm test:all           # Vitest and Playwright
pnpm test:coverage      # report under temp/coverage/
```

Coverage reports are diagnostic and intentionally have no global percentage threshold. Review
untested high-risk branches rather than adding low-value assertions to raise a number.
