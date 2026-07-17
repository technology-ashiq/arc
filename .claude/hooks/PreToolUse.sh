#!/usr/bin/env bash
# === PreToolUse dispatcher (matcher: Bash) ===  runs PreToolUse.d/NN-*.sh (blocking).
# A fragment exiting 2 blocks the command (first block wins, chain stops); the payload
# is captured once and fed to each fragment. Guards live in PreToolUse.d/.
set -uo pipefail
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh" 2>/dev/null || exit 0   # missing dispatcher = fail-open (allow)
arc_dispatch PreToolUse blocking --payload
exit $?
