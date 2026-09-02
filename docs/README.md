# Docs

| Folder                             | What lives here                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| [guides/](./guides/)               | User-facing reference: configuration, advanced CLI usage, troubleshooting             |
| [design/](./design/)               | Design assets: the Claude Design handoff bundle and the design-system spec            |
| [plans/](./plans/)                 | **Active** plans — open or partially shipped work, each with a status line at the top |
| [plans/archive/](./plans/archive/) | **Shipped** plans and historical design docs, kept for rationale and history          |

The architecture reference is the _Project Structure_ section of [AGENTS.md](../AGENTS.md).

## Guides

| Doc                                             | Covers                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| [configuration.md](./guides/configuration.md)   | Every environment variable, provider setup, FFmpeg presets, yt-dlp cookie auth |
| [advanced-usage.md](./guides/advanced-usage.md) | Advanced CLI examples, persistence and re-runs, pre-downloaded videos          |
| [audio-sync.md](./guides/audio-sync.md)         | Audio/video sync troubleshooting and `TIMESTAMP_OFFSET_SECONDS`                |
| [yt-downloader.md](./guides/yt-downloader.md)   | yt-dlp download modes, bot-detection errors, cookie troubleshooting            |
| [free-models.md](./guides/free-models.md)       | Free OpenRouter models that work well with this tool                           |

## Active plans

| Plan                                                             | Status                                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [product-foundation.md](./plans/product-foundation.md)           | **Decided, not started** — customers, 1:1 channel link, jobs; the next workstream |
| [sqlite-migration.md](./plans/sqlite-migration.md)               | Partial (9 of 11) — YouTube auth and user config still file-based                 |
| [editor-save-and-preview.md](./plans/editor-save-and-preview.md) | Partial — implementation shipped, Playwright specs not written                    |

## Archived plans

| Plan                                                                           | What it delivered                                                                   |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [services-refactor.md](./plans/archive/services-refactor.md)                   | Independent services, barrels, boundary test, `run` consolidated onto orchestration |
| [cli-subcommands.md](./plans/archive/cli-subcommands.md)                       | Subcommand CLI sharing the SQLite library with the web app                          |
| [video-qa.md](./plans/archive/video-qa.md)                                     | Video Q&A for CLI and web                                                           |
| [clip-editor.md](./plans/archive/clip-editor.md)                               | Original clip editor design rationale                                               |
| [clip-editor-redesign.md](./plans/archive/clip-editor-redesign.md)             | Editor component redesign                                                           |
| [clip-editor-crop-placement.md](./plans/archive/clip-editor-crop-placement.md) | Freeform crop bars and placement displacement                                       |
| [remove-analysis-file-cache.md](./plans/archive/remove-analysis-file-cache.md) | Analysis layer moved from file cache to DB                                          |
| [remove-clip-file-cache.md](./plans/archive/remove-clip-file-cache.md)         | Clip metadata moved from sidecar files to DB                                        |
| [design.md](./plans/archive/design.md)                                         | Design handoff implementation (four phases)                                         |
| [design-reference.md](./plans/archive/design-reference.md)                     | Retrospective on porting the design bundle                                          |
| [refactor-phases.md](./plans/archive/refactor-phases.md)                       | The first pipeline refactor (pre-services)                                          |
| [build-plan-v2.md](./plans/archive/build-plan-v2.md)                           | The original v2 build plan                                                          |

## Design

| Path                                     | What it is                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| [design/reference/](./design/reference/) | Claude Design handoff bundle: chat transcripts, JSX screens, design-system CSS |
| [design/system/](./design/system/)       | Standalone design-system spec (tokens, components, preview)                    |
