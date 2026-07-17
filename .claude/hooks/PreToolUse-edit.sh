#!/usr/bin/env bash
# === PreToolUse dispatcher (matcher: Edit|Write) ===  runs PreToolUse-edit.d/NN-*.sh (blocking).
# A fragment exiting 2 blocks the edit (e.g. the arc freeze boundary).
set -uo pipefail
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh" 2>/dev/null || exit 0   # missing dispatcher = fail-open (allow)
arc_dispatch PreToolUse-edit blocking --payload
exit $?
