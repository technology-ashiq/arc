#!/usr/bin/env bash
# === SessionStart dispatcher ===  runs .claude/hooks/SessionStart.d/NN-*.sh in order.
# Advisory: always exit 0; one fragment's failure never breaks session startup.
# Fragments (mostly core) live in SessionStart.d/; a product drops one in without
# editing this file. Logic split from the old monolith in Phase 01.
set -uo pipefail
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh" 2>/dev/null || exit 0
arc_dispatch SessionStart advisory
