#!/usr/bin/env bash
# hq -- leave a session.end receipt on the spine (SessionEnd, advisory). Rides note.logged for
# the same reason as SessionStart (no session-lifecycle kind in the closed vocabulary).
# Hook-mode emit: never blocks the session close.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
EVENT=".claude/scripts/hq/arc-event.sh"
[ -f "$EVENT" ] || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "?")
if command -v jq >/dev/null 2>&1; then
  PL=$(jq -cn --arg b "$BRANCH" '{event:"session.end",branch:$b}')
else
  PL='{"event":"session.end"}'
fi
# SYNCHRONOUS on purpose (unlike SessionStart/PostToolUse): the session is ending, so a
# backgrounded emit could be killed with the process tree before it lands. The ~2s cost is
# paid at close, where the user is no longer waiting on the tool.
bash "$EVENT" emit note.logged --payload "$PL" >/dev/null 2>&1 || true
exit 0
