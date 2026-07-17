#!/usr/bin/env bash
# core -- save a state snapshot before compaction (PreCompact) -> .claude/state/last-session.md.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"
STATE_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/state"
mkdir -p "$STATE_DIR"
{
  echo "# Pre-compaction snapshot ($(date '+%Y-%m-%d %H:%M:%S'))"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "- Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
    echo "- Last commit: $(git log -1 --pretty=format:'%h %s' 2>/dev/null)"
    echo "- Uncommitted:"
    git status --porcelain 2>/dev/null | sed 's/^/    /'
  fi
} > "$STATE_DIR/last-session.md"
echo "PreCompact: saved snapshot -> .claude/state/last-session.md"
