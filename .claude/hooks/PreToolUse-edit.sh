#!/usr/bin/env bash
# === PreToolUse hook (matcher: Edit|Write) ===  arc freeze boundary (opt-in).
# No-op unless /arc-freeze created .claude/state/freeze. Delegates to the shared
# script (one owner). exit 0 = allow | exit 2 = block (edit outside the boundary).
set -uo pipefail
exec bash "${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/freeze-check.sh"
