#!/usr/bin/env bash
# === PreToolUse dispatcher (matcher: Read) ===  runs PreToolUse-read.d/NN-*.sh (blocking).
# A fragment exiting 2 blocks the read (e.g. the ui-composer read allowlist, ADR-1415).
set -uo pipefail
# Fail-open loudly on a missing/broken dispatcher (review W1).
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh" 2>/dev/null \
  || { echo "arc: hook dispatcher missing/broken -- guards disarmed; re-sync the template" >&2; exit 0; }
arc_dispatch PreToolUse-read blocking --payload
exit $?
