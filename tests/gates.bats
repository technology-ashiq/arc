#!/usr/bin/env bats
# Phase 02 -- generic gate-runner + arc.gates.yaml (declarative gates).
bats_require_minimum_version 1.5.0
load 'test_helper'

RUNNER() { echo "$ARC_ROOT/.claude/scripts/arc-gates.sh"; }

# Write a gates.yaml, echo its path.
_gates() { local p; p="$(mktemp)"; printf '%s\n' "$1" > "$p"; echo "$p"; }

@test "parser: real arc.gates.yaml parses to 4 valid-JSON gates" {
  run bash "$(RUNNER)" --list --gates-file "$ARC_ROOT/arc.gates.yaml"
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | grep -c .)" -eq 4 ]
  # every line is valid JSON with a name + check
  printf '%s\n' "$output" | while IFS= read -r g; do
    echo "$g" | jq -e '.name != "" and .check != ""' >/dev/null
  done
}

@test "parser: values with flags/paths survive (no truncation at spaces or colons)" {
  local y; y="$(_gates 'gates:
  - name: scan
    check: bash x.sh --base main --exit-zero
    mode: profile
    tier: hook')"
  run bash "$(RUNNER)" --list --gates-file "$y"
  [ "$(printf '%s' "$output" | jq -r '.check')" = "bash x.sh --base main --exit-zero" ]
}

@test "runner: a failing block-mode gate blocks (exit 2)" {
  local y; y="$(_gates 'gates:
  - name: g
    check: bash -c "exit 2"
    mode: block
    tier: hook')"
  run bash "$(RUNNER)" --tier hook --gates-file "$y"
  [ "$status" -eq 2 ]
}

@test "runner: a failing warn-mode gate does NOT block (exit 0)" {
  local y; y="$(_gates 'gates:
  - name: g
    check: bash -c "exit 1"
    mode: warn
    tier: hook')"
  run bash "$(RUNNER)" --tier hook --gates-file "$y"
  [ "$status" -eq 0 ]
}

@test "runner: an off-mode gate is skipped even if it would fail" {
  local y; y="$(_gates 'gates:
  - name: g
    check: bash -c "exit 2"
    mode: off
    tier: hook')"
  run bash "$(RUNNER)" --tier hook --gates-file "$y"
  [ "$status" -eq 0 ]
  [[ "$output" == *"off -- skipped"* ]]
}

@test "runner: profile mode trusts the check exit code (2=block, 1=warn)" {
  local y; y="$(_gates 'gates:
  - name: b
    check: bash -c "exit 2"
    mode: profile
    tier: hook
  - name: w
    check: bash -c "exit 1"
    mode: profile
    tier: hook')"
  run bash "$(RUNNER)" --tier hook --gates-file "$y"
  [ "$status" -eq 2 ]                       # the exit-2 gate blocks
  [[ "$output" == *"[b] FAIL -> BLOCK"* ]]
  [[ "$output" == *"[w] fail -> warn"* ]]
}

@test "runner: tier filter -- ci gates do not run in the hook tier" {
  local y; y="$(_gates 'gates:
  - name: ci_only
    check: bash -c "exit 2"
    mode: block
    tier: ci')"
  run bash "$(RUNNER)" --tier hook --gates-file "$y"
  [ "$status" -eq 0 ]                       # not run -> no block
  [[ "$output" == *"ran=0"* ]]
}

@test "runner: missing gates file degrades to advisory (exit 0, loud)" {
  run bash "$(RUNNER)" --tier hook --gates-file "/no/such/gates.$$.yaml"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED"* ]]
}

@test "review-ledger require-profile blocks when required reviews are unstamped" {
  _arc_sandbox
  cp "$ARC_ROOT/.claude/scripts/arc-profile.sh" .claude/scripts/ 2>/dev/null || true
  run bash .claude/scripts/review-ledger.sh require-profile
  [ "$status" -eq 2 ]                       # standard profile requires code,security
  bash .claude/scripts/review-ledger.sh stamp code
  bash .claude/scripts/review-ledger.sh stamp security
  run bash .claude/scripts/review-ledger.sh require-profile
  [ "$status" -eq 0 ]
}
