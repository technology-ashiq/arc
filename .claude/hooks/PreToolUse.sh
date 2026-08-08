#!/usr/bin/env bash
# === PreToolUse dispatcher (matcher: Bash) ===  runs PreToolUse.d/NN-*.sh (blocking).
# A fragment exiting 2 blocks the command (first block wins, chain stops); the payload
# is captured once and fed to each fragment. Guards live in PreToolUse.d/.
set -uo pipefail
# Fail-open on a missing/broken dispatcher (a broken install must not brick every Bash
# command) -- but LOUDLY, so a disarmed guard is never silent (review W1).
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh" 2>/dev/null \
  || { echo "arc: hook dispatcher missing/broken -- guards disarmed; re-sync the template" >&2; exit 0; }
arc_dispatch PreToolUse blocking --payload
exit $?
