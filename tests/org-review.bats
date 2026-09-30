#!/usr/bin/env bats
# org Phase 01 -- attribution + scorecard (REQ-05; ADR-1603 / ADR-1604; A-01).
#
# org-review scores a seat only from receipts the attribution map places on it. These tests run
# it against two written spines: `full`, where process- and actor-named rules place receipts on
# several seats, and `weak`, which holds only a scheduler heartbeat and a kind-only receipt. The
# weak spine is the day-3 checkpoint's negative control: a checkpoint that passes it would pass
# any spine, whatever the premise.
#
# Every test asserts the tool RAN before asserting what it printed.
bats_require_minimum_version 1.5.0
load 'test_helper'

REVIEW() { printf '%s' "$ARC_ROOT/.claude/scripts/org/org-review.mjs"; }

spine() {
  local d="$BATS_TEST_TMPDIR/spine-$1"
  run node "$ARC_ROOT/tests/org/spine-fixture.mjs" "$d" "$1"
  [ "$status" -eq 0 ] || { echo "fixture failed: $output" >&2; return 1; }
  [[ "$output" == "spine-fixture: "[1-9]* ]] || { echo "empty fixture: $output" >&2; return 1; }
  printf '%s' "$d"
}

@test "org-review: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "org-review: a role's runs are derived from its placed receipts" {
  local s; s=$(spine full) || false
  run node "$(REVIEW)" --role devops-release --spine-dir "$s"
  [[ "$output" == *"org-review: "* ]] || { echo "did not run: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"devops-release "*"runs 2 (1 ok, 1 fail)"* ]] || { echo "$output"; false; }
}

@test "org-review: a role with no placed receipt prints no evidence, never a zero or a percent" {
  local s; s=$(spine full) || false
  run node "$(REVIEW)" --role ux-writer --spine-dir "$s"
  [[ "$output" == *"org-review: 0 of 1 role(s) with evidence"* ]] || { echo "did not run: $output"; false; }
  printf '%s\n' "$output" | grep -Eq '^ux-writer +vacant +no evidence$' || { echo "$output"; false; }
  if printf '%s\n' "$output" | grep '^ux-writer' | grep -Eq '%|runs 0'; then echo "a zero or percent: $output"; false; fi
}

@test "org-review: a decision is placed on the role that raised the approval it decides" {
  local s; s=$(spine full) || false
  run node "$(REVIEW)" --role sdr-outbound --spine-dir "$s"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"sdr-outbound "*"accepts 1 · rejects 0"* ]] || { echo "$output"; false; }
  run node "$(REVIEW)" --role build-in-public-social --spine-dir "$s"
  [[ "$output" == *"accepts 0 · rejects 1"* ]] || { echo "$output"; false; }
}

@test "org-review: payload.role outranks the map, and the disagreement is printed" {
  local s; s=$(spine full) || false
  run node "$(REVIEW)" --role qa-tester --spine-dir "$s"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"qa-tester "*"runs 1 (1 ok, 0 fail)"* ]] || { echo "$output"; false; }
  [[ "$output" == *'CONFLICT '*'payload.role "qa-tester" but map rule commit-msg-draft says "devops-release"'* ]] || { echo "$output"; false; }
}

@test "org-review: unattributed receipts are counted, not guessed" {
  local s; s=$(spine full) || false
  run node "$(REVIEW)" --all --spine-dir "$s"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"unattributed 1 of 11 receipt(s)"* ]] || { echo "$output"; false; }
}

@test "org-review: --audit recomputes every number independently and finds no difference" {
  local s; s=$(spine full) || false
  run node "$(REVIEW)" --audit --spine-dir "$s"
  [[ "$output" =~ audit:\ ([0-9]+)\ roles\ recomputed\ from\ 11\ receipts ]] || { echo "did not run: $output"; false; }
  [ "${BASH_REMATCH[1]}" -gt 0 ]
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"-- 0 difference(s)"* ]] || { echo "$output"; false; }
}

@test "org-review: the checkpoint proceeds on receipts placed by source-naming rules" {
  local s; s=$(spine full) || false
  run node "$(REVIEW)" --checkpoint --spine-dir "$s"
  [[ "$output" == *"checkpoint: map digest "* ]] || { echo "did not run: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PROCEED (>= 3)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"  devops-release: 2 receipt(s)"* ]] || { echo "$output"; false; }
}

@test "org-review: the checkpoint STOPS on heartbeats and kind-only receipts (negative control)" {
  local s; s=$(spine weak) || false
  run node "$(REVIEW)" --checkpoint --spine-dir "$s"
  [[ "$output" == *"checkpoint: map digest "* ]] || { echo "did not run: $output"; false; }
  [ "$status" -eq 1 ] || { echo "a spine of heartbeats passed the checkpoint: $output"; false; }
  [[ "$output" == *"checkpoint: 0 seated role(s) measured from 3 receipts -- STOP"* ]] || { echo "$output"; false; }
}

@test "org-review: a map rule naming a role that is not a card stops scoring" {
  local t="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$t/.claude" "$t/engine" && cp -r "$ARC_ROOT/.claude/agents" "$ARC_ROOT/.claude/skills" "$ARC_ROOT/.claude/scripts" "$t/.claude/"
  cp -r "$ARC_ROOT/processes" "$ARC_ROOT/org" "$t/" && cp "$ARC_ROOT/engine/router.yaml" "$t/engine/" && cp "$ARC_ROOT/hq.policy.yaml" "$ARC_ROOT/ventures.yaml" "$t/"
  printf "  - id: 'zz-ghost'\n    match:\n      process: 'zz'\n    role: 'ghost-role'\n" >> "$t/org/attribution.yaml"
  local s; s=$(spine full) || false
  run node "$(REVIEW)" --all --spine-dir "$s" --root "$t"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *'role "ghost-role" is not a card id'* ]] || { echo "$output"; false; }
  [[ "$output" == *"nothing scored"* ]] || { echo "$output"; false; }
}

@test "org-review: modes are exclusive, flags are never given twice, unknown flags refused" {
  run node "$(REVIEW)" --all --audit
  [ "$status" -eq 2 ] && [[ "$output" == *"exactly one of"* ]] || { echo "$output"; false; }
  run node "$(REVIEW)" --all --since 2026-01-01 --since 2026-02-01
  [ "$status" -eq 2 ] && [[ "$output" == *"--since given twice"* ]] || { echo "$output"; false; }
  run node "$(REVIEW)" --al
  [ "$status" -eq 2 ] && [[ "$output" == *'unknown flag "--al"'* ]] || { echo "$output"; false; }
}
