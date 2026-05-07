#!/usr/bin/env bash
# PreToolUse hook: block Write/Edit that introduces an inline `interface X` or
# `type X = …` declaration in source files outside the canonical type folders.
# Reads the tool-call JSON on stdin, exits 2 with a stderr message on a violation.

set -uo pipefail

input=$(cat)

tool_name=$(printf '%s' "$input" | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
file_path=$(printf '%s' "$input" | python3 -c '
import json, sys
try:
  d = json.load(sys.stdin)
except Exception:
  sys.exit(0)
ti = d.get("tool_input", {}) or {}
fp = ti.get("file_path") or ""
print(fp)
')

# Bail if no file_path (other tools, MultiEdit fallthrough handled below)
[ -z "$file_path" ] && exit 0

# Only police source files
case "$file_path" in
  */src/*) ;;
  *) exit 0 ;;
esac

# Skip canonical homes for type declarations
case "$file_path" in
  */src/lib/types/*) exit 0 ;;
  */src/app/web/types/*) exit 0 ;;
esac

# Only police .svelte and .ts (not .d.ts ambient declarations)
case "$file_path" in
  *.svelte|*.ts)
    case "$file_path" in
      *.d.ts) exit 0 ;;
    esac
    ;;
  *) exit 0 ;;
esac

# Pull the about-to-be-written content. For Write -> tool_input.content;
# for Edit -> tool_input.new_string; for MultiEdit -> concatenate edits[].new_string.
content=$(printf '%s' "$input" | python3 -c '
import json, sys
try:
  d = json.load(sys.stdin)
except Exception:
  sys.exit(0)
ti = d.get("tool_input", {}) or {}
parts = []
if isinstance(ti.get("content"), str):
  parts.append(ti["content"])
if isinstance(ti.get("new_string"), str):
  parts.append(ti["new_string"])
edits = ti.get("edits")
if isinstance(edits, list):
  for e in edits:
    if isinstance(e, dict) and isinstance(e.get("new_string"), str):
      parts.append(e["new_string"])
sys.stdout.write("\n".join(parts))
')

[ -z "$content" ] && exit 0

# Match top-level `interface X` or `type X = …`. Indent up to 4 spaces/tabs to
# allow Svelte <script> indentation. Excludes comments and string contexts in
# practice well enough for a guardrail.
if printf '%s' "$content" | grep -Eq '^[[:space:]]{0,4}(export[[:space:]]+)?(interface|type)[[:space:]]+[A-Z][A-Za-z0-9_]*'; then
  cat >&2 <<EOF
BLOCKED by .claude/hooks/no-inline-types.sh
File: $file_path
Reason: inline \`interface\` or \`type\` declaration in a non-canonical file.

Move the declaration to:
  - src/app/web/types/componentProps.ts   (component Props)
  - src/app/web/types/<domain>.ts         (publish, analysis, upload, web, …)
  - src/lib/types/<domain>.ts             (shared/server)

Then \`import type { ... }\` here. See AGENTS.md "Types location (hard rule)"
or run /new-type for the decision table.
EOF
  exit 2
fi

exit 0
