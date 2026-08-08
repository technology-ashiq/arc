#!/usr/bin/env bash
# === PreCompact dispatcher ===  runs PreCompact.d/NN-*.sh (advisory, no payload).
set -uo pipefail
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh" 2>/dev/null || exit 0
arc_dispatch PreCompact advisory
