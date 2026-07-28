#!/usr/bin/env bash
# design -- design-critic write boundary (PreToolUse/Edit|Write). No-op unless a critique run
# armed .claude/state/design/critic-session. exit 2 = block a critic write outside
# docs/design/critique/. Same shape as 00-freeze.sh: the fragment stays thin, the logic lives
# in a script, and a missing script fails OPEN rather than breaking the session.
set -uo pipefail
SC="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/design/critic-scope-check.sh"
[ -f "$SC" ] || exit 0
exec bash "$SC" "$@"
