#!/usr/bin/env bash
# === PostToolUse dispatcher (matcher: Edit|Write) ===  runs PostToolUse.d/NN-*.sh (advisory).
# Always exit 0; the payload (file just edited) is fed to each fragment.
set -uo pipefail
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh" 2>/dev/null || exit 0
arc_dispatch PostToolUse advisory --payload
