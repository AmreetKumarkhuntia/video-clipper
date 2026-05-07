---
name: audit-types
description: Scan the repo for inline interface/type declarations outside src/lib/types/ and src/app/web/types/. Reports violations as file:line — declaration. Use when the user asks to audit type placement or when /extract-inline-types finishes a batch.
---

# /audit-types

Goal: report every `interface X` or `type X = …` declaration that lives outside the canonical type folders. Inline declarations in `.svelte` and `.ts` files break the project rule (AGENTS.md → "Types location (hard rule)") and prevent reuse across files.

## Run this

```bash
rg -n --no-heading \
  --type-add 'svelte:*.svelte' -t svelte -t ts \
  --glob '!src/lib/types/**' \
  --glob '!src/app/web/types/**' \
  --glob '!**/*.d.ts' \
  '^[[:space:]]{0,4}(export[[:space:]]+)?(interface|type)[[:space:]]+[A-Z]' \
  src
```

If `rg` is unavailable, fall back to:

```bash
grep -rnE '^[[:space:]]{0,4}(export[[:space:]]+)?(interface|type)[[:space:]]+[A-Z]' \
  --include='*.svelte' --include='*.ts' \
  --exclude-dir='src/lib/types' --exclude-dir='src/app/web/types' \
  src
```

## Report format

For the user, write:

- `Found N violations:` followed by a bullet list of `path:line — <first ~80 chars of the matched line>`.
- If `N == 0`: `Clean — no inline interface/type declarations outside src/lib/types/ and src/app/web/types/.`
- If `N > 0`: append `Run /extract-inline-types <path> to move them.`

## Don't

- Don't try to fix anything here. This skill only reports.
- Don't include matches inside `src/lib/types/` or `src/app/web/types/` — those are the legitimate homes.
- Don't flag `.d.ts` ambient declarations.
