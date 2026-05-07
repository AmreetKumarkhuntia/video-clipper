---
name: extract-inline-types
description: Move inline interface/type declarations out of a Svelte or TS file (or directory) into the canonical type folder, then update the source file to import them. Pass a file path, glob, or folder path as args.
---

# /extract-inline-types

Goal: move inline `interface X` / `type X = …` blocks from a target file (or every offender under a folder) into the right canonical type file under `src/app/web/types/` or `src/lib/types/`, and rewrite the source to import them.

This is the corrective tool for AGENTS.md → "Types location (hard rule)". The PreToolUse hook (`.claude/hooks/no-inline-types.sh`) blocks new offenders; this skill fixes existing ones.

## Inputs

`args` is one of:

- single file path (e.g. `src/app/web/components/Toggle.svelte`)
- folder path (e.g. `src/app/web/components/publish`) — process every `.svelte` / `.ts` under it
- glob (e.g. `src/app/web/components/**/*.svelte`) — process every match

## Steps

1. **Resolve targets**: expand `args` into a concrete file list. Skip files already inside `src/lib/types/` or `src/app/web/types/`. Skip `.d.ts`.

2. **For each target file**:
   1. Read the file.
   2. Parse out every top-level `interface X { … }` or `type X = …;` block (max 4-space leading indent — Svelte `<script>` indent).
   3. For each block, decide its destination using the `/new-type` decision table:
      - Component `Props` (the block named exactly `Props` inside a `.svelte`) → `src/app/web/types/componentProps.ts`. Rename to `<ComponentBaseName>Props` (e.g. `Toggle.svelte` → `ToggleProps`).
      - Domain types → match the table in `/new-type` (publish, analysis, upload, web, workflow, youtube, activity, or shared `lib/types/`).
   4. Append the block (with `export` and any required cross-file imports) to the destination file. Preserve comments and JSDoc.
   5. Replace the block in the source file with `import type { <Names> } from '@app/web/types/<file>.js'` (or `@lib/...`). Merge with an existing matching import line if one already exists.
   6. Update the `let { … }: Props = $props();` line to `let { … }: <Component>Props = $props();` if the type was renamed.

3. **Verify after each file or batch**:

   ```bash
   node_modules/.bin/svelte-check --tsconfig tsconfig.web.json
   ```

   Expect 0 new errors. If any appear, the rename is the most likely cause — check that the destination file's exported name matches the import.

4. **Tail-report** to the user: `Moved N declarations from M files into <list of canonical files>. svelte-check: 0 new errors.`

## Naming rules

- Component `Props` → `<ComponentBaseName>Props`. Component base name is the `.svelte` filename without extension, with directory casing preserved (`PublishDraftCard.svelte` → `PublishDraftCardProps`).
- Domain types keep their existing name unless it would collide with an existing export. On collision, prepend the file's domain (`publish.ts` collision → `Publish<X>`).
- For `+layout.svelte` / `+page.svelte` route files, name the Props after the route segment (`videos/[videoId]/+layout.svelte` → `VideoLayoutProps`).

## Don't

- Don't delete or rename existing exported types in domain files. Only append.
- Don't move types that are already imported from elsewhere — only inline declarations.
- Don't bypass the PreToolUse hook. Your edits should never put `interface X`/`type X` text into a non-canonical file; the rewrite always replaces the block with an `import type` statement.
- Don't run a global `git add -A` — stage explicitly so unrelated dirty files don't slip in.
