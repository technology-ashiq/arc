#!/usr/bin/env bats
# distribute Phase 01 -- REQ-01: no blocking rule is enforced only below merge-time (ADR-2002).
#
# gate-parity derives the blocking fragments from disk and checks engine/enforcement.yaml against
# them, never the other way round. Each negative test plants one defect in a TEMP COPY of the tree
# and asserts the gate names it; the real tree must come back with zero gaps. Every run asserts the
# RAN marker before its output is believed (fixed-defects class j).

bats_require_minimum_version 1.5.0
load 'test_helper'

GP() { printf '%s' "$ARC_ROOT/.claude/scripts/core/gate-parity.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

ran() { printf '%s\n' "$output" | tr -d '\r' | grep -qx 'RAN gate-parity' || { echo "gate-parity never reached its end: $output"; return 1; }; }

# A temp copy of exactly what gate-parity reads.
copy_tree() {
  local t="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$t/.claude" "$t/engine" "$t/tests"
  cp -R "$ARC_ROOT/.claude/hooks" "$t/.claude/hooks"
  cp -R "$ARC_ROOT/.githooks" "$t/.githooks"
  cp "$ARC_ROOT/arc.gates.yaml" "$t/arc.gates.yaml"
  cp "$ARC_ROOT/engine/enforcement.yaml" "$t/engine/enforcement.yaml"
  cp "$ARC_ROOT"/tests/*.bats "$t/tests/"
  [ -s "$t/engine/enforcement.yaml" ] && [ -d "$t/.claude/hooks/PreToolUse.d" ] || { echo "copy_tree built an empty tree"; return 1; }
  printf '%s' "$t"
}

@test "distribute-gate-parity: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-gate-parity: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 9 ] || { echo "declared $declared, expected 9"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-gate-parity: the real tree has no gaps and its fragment count matches the disk" {
  run --separate-stderr node "$(GP)" --root "$(native "$ARC_ROOT")"
  ran || false
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  # An independent count of the same thing: every .sh under each event dir whose dispatcher is blocking.
  local n=0 ev
  for ev in $(grep -lE '^[[:space:]]*arc_dispatch[[:space:]]+[^[:space:]]+[[:space:]]+blocking' "$ARC_ROOT"/.claude/hooks/*.sh | xargs -n1 basename | sed 's/[.]sh$//'); do
    n=$((n + $(find "$ARC_ROOT/.claude/hooks/$ev.d" -maxdepth 1 -name '*.sh' | wc -l)))
  done
  [ "$n" -gt 0 ] || { echo "the independent count found no blocking fragments -- could not scan"; false; }
  printf '%s\n' "$output" | tr -d '\r' | grep -qE "^gate-parity: $n fragments, [1-9][0-9]* rules, [0-9]+ rows, 0 gaps$" || { echo "expected $n fragments, 0 gaps: $output"; false; }
}

@test "distribute-gate-parity: the mutant selftest catches a planted hook-only fragment" {
  run --separate-stderr node "$(GP)" --root "$(native "$ARC_ROOT")" --mutant-selftest
  ran || false
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  printf '%s\n' "$output" | grep -q 'mutant-selftest: caught 99-mutant' || { echo "$output"; false; }
}

@test "distribute-gate-parity: a fragment with no row is a named gap" {
  local t; t=$(copy_tree)
  printf '#!/usr/bin/env bash\nexit 2\n' > "$t/.claude/hooks/PreToolUse.d/98-unlisted.sh"
  run --separate-stderr node "$(GP)" --root "$(native "$t")"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | grep -q '^GAP .*98-unlisted' || { echo "the unlisted fragment was not named: $output"; false; }
}

@test "distribute-gate-parity: a row whose fragment file is gone is a named gap" {
  local t; t=$(copy_tree)
  rm "$t/.claude/hooks/PreToolUse-read.d/10-design-composer.sh"
  run --separate-stderr node "$(GP)" --root "$(native "$t")"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | grep -q '^GAP .*PreToolUse-read/10-design-composer' || { echo "the dangling row was not named: $output"; false; }
}

@test "distribute-gate-parity: a blocking row whose merge-time test does not exist is a named gap" {
  local t; t=$(copy_tree)
  sed 's/::distribute-merge-gates: the PR diff adds no secret/::distribute-merge-gates: no such test/' "$ARC_ROOT/engine/enforcement.yaml" > "$t/engine/enforcement.yaml"
  if cmp -s "$ARC_ROOT/engine/enforcement.yaml" "$t/engine/enforcement.yaml"; then echo "the mutant changed nothing"; false; fi
  run --separate-stderr node "$(GP)" --root "$(native "$t")"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | grep -q '^GAP action-commit-credential: merge_time test not found' || { echo "$output"; false; }
}

@test "distribute-gate-parity: a commit-time command missing from the git hooks is a named gap" {
  local t; t=$(copy_tree)
  grep -v 'secret-diff-scan.sh --staged' "$ARC_ROOT/.githooks/pre-commit" > "$t/.githooks/pre-commit"
  if cmp -s "$ARC_ROOT/.githooks/pre-commit" "$t/.githooks/pre-commit"; then echo "the mutant changed nothing"; false; fi
  run --separate-stderr node "$(GP)" --root "$(native "$t")"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | grep -q '^GAP action-commit-credential: commit_time command not run by .githooks' || { echo "$output"; false; }
}

@test "distribute-gate-parity: a merge-time test that can skip is a named gap" {
  local t; t=$(copy_tree)
  awk '{ print } /^@test "distribute-merge-gates: the PR diff adds no secret"/ { print "  skip \"planted\"" }' "$ARC_ROOT/tests/distribute-merge-gates.bats" > "$t/tests/distribute-merge-gates.bats"
  if cmp -s "$ARC_ROOT/tests/distribute-merge-gates.bats" "$t/tests/distribute-merge-gates.bats"; then echo "the mutant changed nothing"; false; fi
  run --separate-stderr node "$(GP)" --root "$(native "$t")"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | grep -q '^GAP action-commit-credential: merge_time test can skip' || { echo "$output"; false; }
}

@test "distribute-gate-parity: no blocking fragment at all is COULD NOT SCAN, never clean" {
  local t; t=$(copy_tree)
  find "$t/.claude/hooks" -name '*.sh' -path '*.d/*' -delete
  run --separate-stderr node "$(GP)" --root "$(native "$t")"
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  printf '%s\n%s\n' "$output" "$stderr" | grep -q 'COULD NOT SCAN' || { echo "$output $stderr"; false; }
  if printf '%s\n' "$output" | grep -q '0 gaps'; then echo "an empty scan was reported clean"; false; fi
}
