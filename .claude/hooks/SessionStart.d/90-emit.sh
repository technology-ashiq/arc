#!/usr/bin/env bash
# hq -- leave a session.start receipt on the spine (SessionStart, advisory). Session lifecycle
# has no dedicated Appendix-A kind (ADR-0026 closed the vocabulary at 18), so it rides
# note.logged. Hook-mode emit: never blocks the session; a bad emit quarantines and exits 0.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
EVENT=".claude/scripts/hq/arc-event.sh"
[ -f "$EVENT" ] || exit 0                     # hq not installed here -> nothing to emit
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "?")
if command -v jq >/dev/null 2>&1; then
  PL=$(jq -cn --arg b "$BRANCH" '{event:"session.start",branch:$b}')
else
  PL='{"event":"session.start"}'
fi
# ASYNC (~2s/emit > the 1s budget). SessionStart must not delay the session becoming ready,
# so fire-and-forget in the background; the session outlives it. SessionEnd stays synchronous
# because there the process is about to die and the receipt must land first.
nohup bash "$EVENT" emit note.logged --payload "$PL" >/dev/null 2>&1 &
exit 0
