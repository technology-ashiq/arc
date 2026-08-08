#!/usr/bin/env bash
# === SessionEnd dispatcher ===  runs SessionEnd.d/NN-*.sh (advisory, no payload).
set -uo pipefail
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh" 2>/dev/null || exit 0
arc_dispatch SessionEnd advisory
