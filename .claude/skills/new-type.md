---
name: new-type
description: Decide where a new TypeScript interface or type belongs and add it there before referencing it elsewhere. Pass the proposed type name and a one-line purpose as args. Consult this any time you are about to write `interface X` or `type X = …`.
---

# /new-type

Goal: place every new type in a canonical file under `src/lib/types/` or `src/app/web/types/`, never inline. The PreToolUse hook (`.claude/hooks/no-inline-types.sh`) blocks inline declarations; this skill keeps you on the legal path.

## Inputs

`args`: `<TypeName> <one-line purpose>`. Example: `args = "PublishDraftItemEvent payload emitted when a draft clip is updated"`.

## Decision table

Pick the destination file based on what the type describes:

| Domain / kind                                                                                                                      | File                                  |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Component `Props` (any `.svelte` file)                                                                                             | `src/app/web/types/componentProps.ts` |
| Publish drafts, upload artifacts, YouTube auth state                                                                               | `src/app/web/types/publish.ts`        |
| Analysis pipeline outputs, candidate clips, video metadata (web view)                                                              | `src/app/web/types/analysis.ts`       |
| Activity / streaming-event view models                                                                                             | `src/app/web/types/activity.ts`       |
| Upload streaming queue / event names                                                                                               | `src/app/web/types/upload.ts`         |
| Workflow step ids and step shapes                                                                                                  | `src/app/web/types/workflow.ts`       |
| YouTube channel/uploads (web view)                                                                                                 | `src/app/web/types/youtube.ts`        |
| Generic web/app types not matching above                                                                                           | `src/app/web/types/web.ts`            |
| Shared/server: pipeline, analyzer, audio, transcript, segment, video, downloader, cache, config, cli, factory, server-side youtube | `src/lib/types/<matching file>.ts`    |

If nothing fits, **ask the user** before declaring. Do not invent a new bucket file silently.

## Steps

1. Open the destination file from the table.
2. Append the new type with `export`. Preserve alphabetical / logical grouping if the file has one. Add a one-line JSDoc only when the name + signature don't make the purpose obvious.
3. Save the destination file _first_. Run `node_modules/.bin/svelte-check --tsconfig tsconfig.web.json` if the type closes a callback signature or generics that other files already use.
4. Then go to the call site and `import type { <Name> } from '@app/web/types/<file>.js'` (or `@lib/types/<file>.js`).
5. Use the type at the call site.

## Naming hints

- Use the noun, not the verb. `PublishDraftItemEvent` (event payload), not `OnUpdate`.
- For event payloads: suffix with `Event`. For option-shape generics: suffix with `Option`.
- Component `Props`: `<ComponentBaseName>Props`.

## Hard rules

- No `interface` or `type` outside the table's files. The harness will block it.
- Per-component `Props` are not exempt. They live in `componentProps.ts`.
- If editing an existing call site that has an inline declaration: use `/extract-inline-types <path>` to clean it up rather than re-typing the contents.
