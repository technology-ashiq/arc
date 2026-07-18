#!/usr/bin/env bash
# core -- arc freeze boundary (PreToolUse/Edit|Write). No-op unless /arc-freeze created
# .claude/state/freeze. exit 2 = block an edit outside the boundary.
set -uo pipefail
FC="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/core/freeze-check.sh"
[ -f "$FC" ] || exit 0
exec bash "$FC"
