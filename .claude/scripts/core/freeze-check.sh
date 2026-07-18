#!/usr/bin/env bash
# freeze-check.sh -- arc- enforcement moat
# Deterministic edit-boundary. If .claude/state/freeze exists, edits are allowed
# ONLY inside the directories listed in it (one path per line). The enforced,
# can't-forget version of gstack's /freeze skill.
#
# Called from the PreToolUse (Edit|Write) branch. Reads the target file path from
# the first arg, or from tool_input JSON on stdin.
#
# Exit: 0 allow | 2 BLOCK (edit outside the frozen boundary)
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FREEZE="$ROOT/.claude/state/freeze"

# No freeze file -> no restriction.
[ -f "$FREEZE" ] || exit 0

TARGET="${1:-}"
if [ -z "$TARGET" ] && [ ! -t 0 ]; then
  STDIN="$(cat)"
  if command -v jq >/dev/null 2>&1; then
    TARGET="$(printf '%s' "$STDIN" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)"
  else
    TARGET="$(printf '%s' "$STDIN" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
  fi
fi
[ -z "$TARGET" ] && exit 0   # can't tell -> don't block

# Normalise to repo-relative
case "$TARGET" in "$ROOT"/*) TARGET="${TARGET#$ROOT/}";; esac

while IFS= read -r allowed; do
  allowed="$(echo "$allowed" | sed 's#/*$##; s/^[[:space:]]*//; s/[[:space:]]*$//')"
  [ -z "$allowed" ] && continue
  case "$TARGET" in
    "$allowed"|"$allowed"/*) exit 0;;
  esac
done < "$FREEZE"

echo "BLOCKED by /arc-freeze: edits restricted to -> $(tr '\n' ' ' < "$FREEZE")" >&2
echo "Target '$TARGET' is outside the frozen boundary. Run /arc-unfreeze to release." >&2
exit 2
