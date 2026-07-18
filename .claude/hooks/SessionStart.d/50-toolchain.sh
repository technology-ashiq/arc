#!/usr/bin/env bash
# core -- toolchain health brief (SessionStart). One place checks every tool; full
# report + one-command fixes via /arc-toolcheck. Degrades loudly if the checker is absent.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"
HEALTH="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/core/toolchain-health.sh"
if [ -f "$HEALTH" ]; then
  bash "$HEALTH" --brief 2>/dev/null || echo "- Toolchain: run /arc-toolcheck to verify tools"
else
  echo "- Toolchain: checker missing -> re-sync the template, then run /arc-toolcheck"
fi
exit 0
