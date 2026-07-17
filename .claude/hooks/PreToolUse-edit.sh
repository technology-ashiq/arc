#!/usr/bin/env bash
# === PreToolUse dispatcher (matcher: Edit|Write) ===  runs PreToolUse-edit.d/NN-*.sh (blocking).
# A fragment exiting 2 blocks the edit (e.g. the arc freeze boundary).
set -uo pipefail
# Fail-open loudly on a missing/broken dispatcher (review W1).
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh" 2>/dev/null \
  || { echo "arc: hook dispatcher missing/broken -- guards disarmed; re-sync the template" >&2; exit 0; }
arc_dispatch PreToolUse-edit blocking --payload
exit $?
