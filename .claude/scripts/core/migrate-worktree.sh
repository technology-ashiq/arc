#!/usr/bin/env bash
# migrate-worktree.sh -- one worker's worktree for one lane migration (ci Phase 02, PLAN-ci D.1/D.2):
# E:/Work_Hub/01_Automemory/wt-migrate-<lane> on branch migrate/<lane> from origin/main, then the launch line.
# Outside the scratchpad, because that path is too long for git worktrees on Windows.
#
#   bash .claude/scripts/core/migrate-worktree.sh <lane> [--root DIR]
set -euo pipefail
lane="${1:-}"
[[ "$lane" =~ ^[a-z][a-z0-9-]*$ ]] || { echo "usage: migrate-worktree.sh <lane> [--root DIR]" >&2; exit 2; }
root="${ARC_MIGRATE_ROOT:-E:/Work_Hub/01_Automemory}"
[ "${2:-}" = "--root" ] && { root="${3:?--root needs a value}"; }
cd "$(git rev-parse --show-toplevel)"
ls tests/"$lane"-*.bats >/dev/null 2>&1 || [ -f "tests/$lane.bats" ] || { echo "migrate-worktree: lane $lane has no tests/$lane-*.bats to migrate" >&2; exit 1; }
wt="$root/wt-migrate-$lane"
[ ! -e "$wt" ] || { echo "migrate-worktree: $wt already exists -- one worker per lane" >&2; exit 1; }
git rev-parse --verify --quiet "refs/heads/migrate/$lane" >/dev/null && { echo "migrate-worktree: branch migrate/$lane already exists" >&2; exit 1; }
git fetch -q origin main
git worktree add -q -b "migrate/$lane" "$wt" origin/main
echo "migrate-worktree: $wt on migrate/$lane (from origin/main $(git rev-parse --short origin/main))"
echo "launch (owner picks the model, PLAN-ci D.2):"
echo "  cd \"$wt\" && claude      # with ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_MODEL set to the gateway"
echo "then paste the brief from tests/MIGRATING.md with Lane: $lane"
