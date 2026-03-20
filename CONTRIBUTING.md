# Contributing

## Getting Started

```bash
pnpm install
```

This will install all dependencies and set up git hooks via Husky.

## Commit Message Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by [commitlint](https://commitlint.js.org/).

### Format

```
<type>(<scope>): <short description>

- <detail 1>
- <detail 2>
```

### Types

| Type       | Description                                             | Version Bump           |
| ---------- | ------------------------------------------------------- | ---------------------- |
| `feat`     | New feature                                             | minor (1.0.0 -> 1.1.0) |
| `fix`      | Bug fix                                                 | patch (1.0.0 -> 1.0.1) |
| `docs`     | Documentation only                                      | none                   |
| `refactor` | Code change that neither fixes a bug nor adds a feature | none                   |
| `test`     | Adding or updating tests                                | none                   |
| `chore`    | Maintenance tasks (deps, config, etc.)                  | none                   |
| `style`    | Formatting, missing semicolons, etc. (no code change)   | none                   |
| `perf`     | Performance improvement                                 | none                   |
| `ci`       | CI/CD configuration changes                             | none                   |
| `build`    | Build system or external dependency changes             | none                   |
| `revert`   | Reverts a previous commit                               | none                   |

### Rules

- **type** (required): one from the table above
- **scope** (recommended): kebab-case name of the feature area, e.g. `release`, `transcript-fetcher`, `llm-analyzer`
- **short description** (required): lowercase, imperative mood, max 100 chars, no period at end
- **body** (optional): pointwise with `-`, max 500 chars total

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

### Breaking Changes

Add `BREAKING CHANGE:` in the commit body or `!` after the type to trigger a major version bump:

```
feat(config)!: rename ENV_VAR to NEW_ENV_VAR

BREAKING CHANGE: ENV_VAR is no longer supported, use NEW_ENV_VAR instead
```

## Git Hooks

The following hooks run automatically on every commit:

| Hook         | What it runs                                                  |
| ------------ | ------------------------------------------------------------- |
| `pre-commit` | `lint-staged` (Prettier), `type-check` (tsc), `test` (vitest) |
| `commit-msg` | `commitlint` (validates commit message format)                |

If your commit is rejected, check the error output — it will tell you exactly which rule was violated.

## Code Style

- TypeScript only — no plain `.js` files
- Prettier handles formatting automatically via `lint-staged`
- Run `pnpm format` to format all files manually
- Run `pnpm type-check` to check for type errors

## Testing

- Write unit tests for pure functions
- Test files live in `tests/` at the project root
- Run `pnpm test` to run all tests
- Run `pnpm test:watch` for watch mode
