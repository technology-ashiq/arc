#!/usr/bin/env bats
# distribute Phase 01 -- the merge-time twins that did not exist (fragment census, 2026-10-07).
#
# Test 2 IS a merge-time gate: on every PR run it scans the lines the PR adds for secrets, and a
# required check makes it final (ADR-2002, ADR-2015). The same script is the commit-time line in
# .githooks/pre-commit (ADR-2013). A missing scanner on CI is a FAILURE, never a skip (class e).
# The planted key lives in a fixture as two halves that no scanner matches until a test joins them,
# so this file and its fixture never trip test 2 themselves.

bats_require_minimum_version 1.5.0
load 'test_helper'

SDS() { printf '%s' "$ARC_ROOT/.claude/scripts/core/secret-diff-scan.sh"; }
BG() { printf '%s' "$ARC_ROOT/.claude/scripts/core/branch-guard.sh"; }

ran() { printf '%s\n' "$output" | tr -d '\r' | grep -qx "RAN $1" || { echo "$1 never reached its end: $output"; return 1; }; }

# A throwaway repo with a repo-local identity (a clean CI runner has no global one).
mk_repo() {
  local r="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$r" && git -C "$r" init -q -b feat/x
  git -C "$r" config user.email ci@example.invalid && git -C "$r" config user.name ci
  printf 'base\n' > "$r/a.txt" && git -C "$r" add a.txt && git -C "$r" commit -q -m base
  printf '%s' "$r"
}

planted_line() {
  local h="$ARC_ROOT/tests/distribute/fixtures/planted-key-halves.txt"
  [ -s "$h" ] || { echo "planted-key fixture missing"; return 1; }
  printf 'aws_access_key_id = "%s%s"%s\n' "$(sed -n 1p "$h" | tr -d '\r')" "$(sed -n 2p "$h" | tr -d '\r')" "$1"
}

@test "distribute-merge-gates: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-merge-gates: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 7 ] || { echo "declared $declared, expected 7"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-merge-gates: the PR diff adds no secret" {
  cd "$ARC_ROOT"
  run --separate-stderr bash "$(SDS)" --merge-parent
  ran secret-diff-scan || { echo "stderr: $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "status $status -- a secret in the lines this change adds, or the scan could not run. Mark a deliberate test fixture with gitleaks:allow. $output $stderr"; false; }
  printf '%s\n' "$output" | grep -qE '^secret-diff-scan: [0-9]+ added line\(s\) scanned, clean$' || { echo "$output"; false; }
}

@test "distribute-merge-gates: a staged planted key is refused" {
  local r; r=$(mk_repo)
  planted_line '' > "$r/creds.txt" && git -C "$r" add creds.txt
  cd "$r"
  run --separate-stderr bash "$(SDS)" --staged
  ran secret-diff-scan || { echo "stderr: $stderr"; false; }
  [ "$status" -eq 1 ] || { echo "status $status: $output $stderr"; false; }
  printf '%s\n' "$output" | grep -q '^secret-diff-scan: SECRET' || { echo "$output"; false; }
}

@test "distribute-merge-gates: a planted key marked gitleaks:allow passes" {
  local r; r=$(mk_repo)
  planted_line ' # gitleaks:allow' > "$r/creds.txt" && git -C "$r" add creds.txt
  cd "$r"
  run --separate-stderr bash "$(SDS)" --staged
  ran secret-diff-scan || { echo "stderr: $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
}

@test "distribute-merge-gates: a missing scanner on CI is COULD NOT SCAN, never clean" {
  local r; r=$(mk_repo)
  printf 'harmless\n' > "$r/b.txt" && git -C "$r" add b.txt
  cd "$r"
  CI=true ARC_GITLEAKS="$BATS_TEST_TMPDIR/no-such-gitleaks" run --separate-stderr bash "$(SDS)" --staged
  [ "$status" -eq 2 ] || { echo "status $status: $output $stderr"; false; }
  printf '%s\n%s\n' "$output" "$stderr" | grep -q 'COULD NOT SCAN' || { echo "$output $stderr"; false; }
  if printf '%s\n' "$output" | grep -q 'clean'; then echo "a scan that never ran was reported clean"; false; fi
}

@test "distribute-merge-gates: branch-guard refuses a commit on main and passes on a feature branch" {
  local r; r=$(mk_repo)
  cd "$r"
  run --separate-stderr bash "$(BG)"
  ran branch-guard || { echo "stderr: $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "feature branch refused: $output $stderr"; false; }
  git checkout -q -b main
  run --separate-stderr bash "$(BG)"
  [ "$status" -eq 1 ] || { echo "a commit on main was allowed: $status $output"; false; }
  printf '%s\n%s\n' "$output" "$stderr" | grep -q 'refuses a commit on main' || { echo "$output $stderr"; false; }
}

@test "distribute-merge-gates: branch-guard pre-push refuses a push to main and passes a feature ref" {
  local r; r=$(mk_repo)
  cd "$r"
  local sha; sha=$(git rev-parse HEAD)
  run --separate-stderr bash "$(BG)" --pre-push <<< "refs/heads/feat/x $sha refs/heads/feat/x 0000000000000000000000000000000000000000"
  ran branch-guard || { echo "stderr: $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "a feature push was refused: $output $stderr"; false; }
  run --separate-stderr bash "$(BG)" --pre-push <<< "refs/heads/feat/x $sha refs/heads/main 0000000000000000000000000000000000000000"
  [ "$status" -eq 1 ] || { echo "a push to main was allowed: $status $output"; false; }
  printf '%s\n%s\n' "$output" "$stderr" | grep -q 'refuses a push to main' || { echo "$output $stderr"; false; }
}
