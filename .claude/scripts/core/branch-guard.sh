#!/usr/bin/env bash
# core -- branch-guard: the commit-time line for "never commit or push straight to main" (ADR-2013).
#
#   branch-guard.sh              refuse when the current branch is main      (.githooks/pre-commit)
#   branch-guard.sh --pre-push   read git's pre-push lines on stdin and refuse any ref bound for main
#
# This is the SECOND line. The truth is the server: a protected main refuses a direct push from any
# harness (ADR-2015), and `git commit --no-verify` skips this file by design (ADR-2002).
# Exit: 0 allowed · 1 refused · 2 usage.
set -u

case "${1:-}" in
  "")
    b=$(git symbolic-ref --short -q HEAD 2>/dev/null || true)
    if [ "$b" = "main" ]; then
      echo "branch-guard: refuses a commit on main -- work on a feat/* branch (CLAUDE rules, ADR-2015)" >&2
      echo "RAN branch-guard"
      exit 1
    fi
    echo "branch-guard: branch ${b:-detached} ok"
    ;;
  --pre-push)
    refused=0
    while read -r lref lsha rref rsha; do
      [ -n "${rref:-}" ] || continue
      if [ "$rref" = "refs/heads/main" ]; then
        echo "branch-guard: refuses a push to main ($lref) -- open a PR instead" >&2
        refused=1
      fi
    done
    echo "RAN branch-guard"
    exit "$refused"
    ;;
  *) echo "usage: branch-guard.sh [--pre-push]" >&2; exit 2 ;;
esac
echo "RAN branch-guard"
