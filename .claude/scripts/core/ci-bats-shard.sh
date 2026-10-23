#!/usr/bin/env bash
# ci-bats-shard.sh -- run bats shard I of N for the one-Linux gate (ci ADR-2201), then reconcile what
# bats EXECUTED against what the shard's files DECLARE. Files go round-robin by sorted path; Linux
# bills at 1x, so balance only has to be rough and there is no timing file to rot.
#
#   bash .claude/scripts/core/ci-bats-shard.sh I N
#
# The reconcile is moved verbatim from the old ci.yml (em-dash incident, 2026-07-30): a test bats
# never runs is indistinguishable from one that passes unless the TAP lines are counted.
set -euo pipefail
[ "$#" -eq 2 ] && [[ "$1" =~ ^[0-9]+$ ]] && [[ "$2" =~ ^[1-9][0-9]*$ ]] || { echo "usage: ci-bats-shard.sh I N"; exit 2; }
cd "$(git rev-parse --show-toplevel)"

files=()
while IFS= read -r f; do files+=("$f"); done < <(find tests -name '*.bats' | LC_ALL=C sort | awk -v i="$1" -v n="$2" 'NR % n == i')
[ "${#files[@]}" -gt 0 ] || { echo "::error::shard $1/$2 resolved to no files"; exit 1; }
echo "shard $1/$2 runs ${#files[@]} file(s)"

_tap="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/bats-shard-$1.tap"
_reconcile() {
  local declared="$1" executed
  executed="$(grep -cE '^(ok|not ok) ' "$_tap" || true)"
  echo "reconcile: declared $declared, executed $executed"
  if [ "$declared" -ne "$executed" ]; then
    echo "::error::$(( declared - executed )) declared test(s) never executed -- a test that does not run is indistinguishable from one that passes"
    grep -nE '^# bats warning:' "$_tap" || true
    return 1
  fi
  if grep -qE '^# bats warning:' "$_tap"; then
    echo "::error::bats emitted a warning; treating as non-execution"
    grep -nE '^# bats warning:' "$_tap"
    return 1
  fi
  return 0
}
_declared() { grep -hcE '^[[:blank:]]*@test[[:blank:]]' "$@" | awk '{s+=$1} END{print s+0}'; }

set +e; bats --print-output-on-failure "${files[@]}" 2>&1 | tee "$_tap"; _rc=${PIPESTATUS[0]}; set -e
set +e; _reconcile "$(_declared "${files[@]}")"; _rrc=$?; set -e
rm -f "$_tap"
[ "$_rc" -eq 0 ] || exit "$_rc"
exit "$_rrc"
