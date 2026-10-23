#!/usr/bin/env bash
# ci-quality.sh -- the `quality` job's gates, one list for CI and for `npm run ci` on the owner's box (ci REQ-04,
# ADR-2203): the two cannot drift because neither holds its own copy. These are also the paperwork gates
# (REQ-02): a docs-only PR skips bats, so every check that reads plans and docs runs here. Needs bats on PATH.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
step() { echo "== $*"; "$@"; }
step bash .claude/scripts/review/arc-scan/version-gate.sh
step node .claude/scripts/core/product-lint.mjs
# gate-parity, brain-drift, arc-compile --check: a docs-only PR that drops a file they name must fail here,
# because bats -- their other caller -- is skipped on it (attack p01 B8).
step npm run --silent lint
# Lanes by the lanes.md grammar; a root-mode tree has none, and an archive dir is not a lane (attack p01 B4).
shopt -s nullglob
for d in initiatives/*/; do
  l="$(basename "$d")"
  [[ "$l" =~ ^[a-z][a-z0-9-]*$ ]] || { echo "-- skip initiatives/$l (not a lane name)"; continue; }
  step node .claude/scripts/plan/kickoff-lint.mjs --lane "$l"
done
step node .claude/scripts/docs/wiki-build.mjs --check
step node .claude/scripts/docs/wiki-coverage.mjs
step node .claude/scripts/core/face-coverage.mjs
step bats --print-output-on-failure tests/portfolio-board.bats
echo "ci-quality: all gates green"
