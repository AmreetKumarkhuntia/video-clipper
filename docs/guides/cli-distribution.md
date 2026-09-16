# Building and releasing the CLI

The root package is private to npm. `packages/cli/package.json` is the complete publish manifest; `src/app/cli/` remains the source. The API/web builds continue to serve deployment and are never copied into an npm archive.

## Local verification

```sh
pnpm build:cli
pnpm verify:cli-package
```

The build creates `artifacts/cli/`, a source/import/hash record at `artifacts/cli-build.json`, and the compiled release plugin. Verification runs the release preparation hook: it creates both registry variants, packs them, and installs each archive in a separate system temporary directory. It checks the installed manifest, executable checksum, dependency tree, command shim, offline help, and version. Dependency lifecycle scripts are disabled, and install/smoke subprocesses receive an allowlisted environment without release or provider credentials. Verification makes no publication request. npm needs registry/cache access for these normal installations.

Only four package files are permitted: `package.json`, `README.md`, `LICENSE`, and `bin/vdclip.js`. The runtime dependencies are Zod, nanoid, and `open` with its small platform helpers. CI rejects undeclared dependencies, unexpected transitive packages, native addons, and install scripts. The esbuild input graph must stay within CLI sources, shared types, and utilities, even when a forbidden import is indirect.

All source is TypeScript. The Node ESM bundle preserves its shebang and reads the nearest package manifest for `--version`, so release-time versioning cannot leave an older version embedded in the executable. Development builds use `0.0.0-development`, which the publish hook refuses; the private root package's historical version is not the CLI release version.

## Release workflow

A push to `master` runs CI once: type, format, Vitest, build, browser, and CLI-package checks. The package matrix covers Node 22/24 on Linux, macOS, and Windows. The release workflow listens for a successful CI push run on `master`, checks out that run's exact source SHA, and serializes publication jobs. Pull-request and non-push CI runs never start a release.

The release job builds the CLI and runs semantic-release. Its npm plugin stamps only `artifacts/cli/package.json`. The local release plugin then prepares and verifies both final archives. A recorded dirty build or a changed source commit/executable blocks release. Semantic-release writes `CLI_CHANGELOG.md`, creates the `vdclip-v*` tag and GitHub release, and does not modify the legacy package changelog. No post-build pull or root package rename occurs.

Publication sends the verified `.tgz` directly to each registry with lifecycle scripts disabled. The two registry names remain:

- npm: `vdclip`
- GitHub Packages: `@amreetkumarkhuntia/vdclip`

The variants share executable bytes and version, but have different package names and archive hashes. The workflow stores the archives, source record, release manifest, and per-registry receipts as a GitHub Actions artifact for 14 days, including on failure. No tokens are stored in those files.

The workflow uses `NPM_TOKEN`, the workflow's package-write token for GitHub Packages, and the existing `PUSH_TOKEN` when provided for release git/GitHub operations. The checkout does not persist its write credential through dependency installation or build. Release tokens are supplied only to semantic-release; its archive verification subprocesses scrub them. Direct invocation of the plugin uses `GH_PACKAGES_TOKEN` for the package-write token. All publication is separate from backend deployment.

The `vdclip-v*` tag namespace gives the new npm package an independent release history. The baseline tag `vdclip-v0.0.0` marks the pre-package `master` commit, so the first release notes contain only this migration. The squash commit must retain `feat(cli)!:` or a `BREAKING CHANGE:` footer so semantic-release advances the stable branch directly to the first published version, `1.0.0`. Existing `v*` tags and the `@thunderkiller/video-clipper` package remain unchanged.

## Retrying a partial registry publication

Restore the original workflow artifact's release files into `artifacts/releases/` in a checkout of the matching implementation, and install repository development dependencies with the frozen pnpm lockfile. Supply `NPM_TOKEN` and `GH_PACKAGES_TOKEN` through the environment, then run:

```sh
pnpm release:retry-cli
```

This command never builds or repacks. It checks the stored archive hashes and the registry's existing `dist.integrity`, skips a matching publication, and publishes only a missing version using the recorded distribution tag. Different existing contents or an unavailable registry stop the retry. It does not recreate a missing GitHub Release page or change git tags; those can be recovered separately using the original release tag.

## Remaining hosted-client work

This is the package/release slice of [the distribution plan](../plans/cli-only-distribution.md). Hosted-origin preferences, comprehensive customer ownership, safe remote file contracts, and download commands remain separate implementation slices. The package is a client of the existing backend; shrinking its contents does not change the backend's current authorization or filesystem contract.
