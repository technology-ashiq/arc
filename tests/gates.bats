#!/usr/bin/env bats
# Phase 02 -- generic gate-runner + arc.gates.yaml (declarative gates).
bats_require_minimum_version 1.5.0
load 'test_helper'

RUNNER() { echo "$ARC_ROOT/.claude/scripts/arc-gates.sh"; }

# Write a gates.yaml, echo its path.
_gates() { local p; p="$(mktemp)"; printf '%s\n' "$1" > "$p"; echo "$p"; }

@test "parser: real arc.gates.yaml parses to 5 valid-JSON gates" {
  run bash "$(RUNNER)" --list --gates-file "$ARC_ROOT/arc.gates.yaml"
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | grep -c .)" -eq 5 ]
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

# ---------- Phase 02: review-ledger derives VALID_KINDS from the registry (REQ-08) ----------

@test "review-ledger: no registry falls back to all kinds (old installs unbroken)" {
  _arc_sandbox
  run bash .claude/scripts/review-ledger.sh stamp design
  [ "$status" -eq 0 ]                          # 'design' valid with no registry present
}

@test "review-ledger: a council-only registry rejects 'code' with a product-install hint (REQ-08)" {
  _arc_sandbox
  mkdir -p .claude
  printf '{"schema":1,"source":{"commit":"x"},"products":{"core":{"files":[]},"council":{"files":[]}}}' > .claude/arc-registry.json
  run bash .claude/scripts/review-ledger.sh stamp code
  [ "$status" -eq 1 ]
  [[ "$output" == *"review"* ]]                # hints the product that provides 'code'
  [[ "$output" == *"--products"* ]]
}

@test "review-ledger: a review+qa registry makes code+design valid" {
  _arc_sandbox
  mkdir -p .claude
  printf '{"schema":1,"source":{"commit":"x"},"products":{"core":{"files":[]},"review":{"files":[]},"qa":{"files":[]}}}' > .claude/arc-registry.json
  run bash .claude/scripts/review-ledger.sh stamp code
  [ "$status" -eq 0 ]
  run bash .claude/scripts/review-ledger.sh stamp design
  [ "$status" -eq 0 ]
}

@test "review-ledger: a malformed registry falls back to all kinds, never blocks (adversarial)" {
  _arc_sandbox
  mkdir -p .claude
  printf '{ not json ' > .claude/arc-registry.json
  run bash .claude/scripts/review-ledger.sh stamp code
  [ "$status" -eq 0 ]                          # fail-safe: bad registry -> hardcoded fallback
}

@test "review-ledger: a glob-metachar product key can't expand against CWD to grant kinds (adversarial, pinned)" {
  _arc_sandbox
  mkdir -p .claude
  printf '{"schema":1,"source":{"commit":"x"},"products":{"*":{"files":[]}}}' > .claude/arc-registry.json
  : > review                                   # the file '*' would glob to if the loop were unquoted
  run bash .claude/scripts/review-ledger.sh stamp code
  [ "$status" -eq 1 ]                          # '*' stays literal (set -f) -> 'code' never granted
}
