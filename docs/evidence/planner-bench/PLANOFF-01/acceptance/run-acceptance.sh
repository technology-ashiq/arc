#!/usr/bin/env bash
# PLANOFF-01 — run the shared acceptance suite against one arm's build.
#
#   ./run-acceptance.sh <arm> [base-url]
#     e.g. ./run-acceptance.sh arc http://localhost:3000
#
# Writes:  ../runs/<arm>/evidence/acceptance.txt   (raw stdout — the evidence)
#          ../runs/<arm>/acceptance.json           (machine summary — read by metrics-collect.sh)
#
# Run this ONLY after the arm's session is over and its evidence is captured. The arm must never
# see this suite; an arm that can read the grader is an arm that optimises for the grader.
set -euo pipefail

ARM="${1:-}"
BASE="${2:-http://localhost:3000}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$ARM" ]]; then
  echo "usage: run-acceptance.sh <arm: arc|raw|gsd|gstack|superpowers> [base-url]" >&2
  exit 2
fi

case "$ARM" in
  arc | raw | gsd | gstack | superpowers) ;;
  *) echo "unknown arm '$ARM' — expected one of: arc raw gsd gstack superpowers" >&2; exit 2 ;;
esac

command -v node >/dev/null || { echo "node is required (>= 20, for built-in fetch)" >&2; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 20 )); then
  echo "node >= 20 required (found $(node -v)) — the suite relies on built-in fetch" >&2
  exit 1
fi

RUN_DIR="$HERE/../runs/$ARM"
mkdir -p "$RUN_DIR/evidence"

echo "→ grading arm '$ARM' at $BASE"
set +e
BASE_URL="$BASE" OUT="$RUN_DIR/acceptance.json" node "$HERE/acceptance.mjs" 2>&1 | tee "$RUN_DIR/evidence/acceptance.txt"
STATUS="${PIPESTATUS[0]}"
set -e

echo
if [[ "$STATUS" -eq 0 ]]; then
  echo "✓ $ARM: all checks passed"
else
  echo "✗ $ARM: some checks failed — see $RUN_DIR/evidence/acceptance.txt (this is data, not a problem to fix)"
fi
echo "  evidence → $RUN_DIR/evidence/acceptance.txt"
echo "  summary  → $RUN_DIR/acceptance.json"

# Never fail the operator's shell: a red suite is a legitimate result.
exit 0
