#!/usr/bin/env bash
# core -- append a session summary to docs/session-log.md (git-versioned) at SessionEnd.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

LOG="docs/session-log.md"
mkdir -p docs
[ -f "$LOG" ] || printf '# Session log\n\nAppended automatically by the SessionEnd hook. Newest entry at the bottom.\n' > "$LOG"

BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "?")
LAST=$(git log -1 --pretty=format:'%h %s' 2>/dev/null || echo "no commits yet")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
NOW=$(awk '/^## Now/{f=1;next} /^## /{f=0} f' PROGRESS.md 2>/dev/null | head -n 3 | sed 's/^/    /')

{
  echo ""
  echo "## $(date '+%Y-%m-%d %H:%M') — ${BRANCH}"
  echo "- Last commit: ${LAST}"
  echo "- Uncommitted files at exit: ${DIRTY}"
  if [ -n "${NOW}" ]; then
    echo "- Position (PROGRESS.md ## Now):"
    echo "${NOW}"
  fi
} >> "$LOG"
exit 0
