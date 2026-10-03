#!/usr/bin/env bats
# launch Phase 00 -- the contract gate (REQ-01; ADR-1701..1705, 1709, 1715, 1717, 1719).
#
# launch-lint passes on the real slot catalog and provider registry, and its mutant self-test proves every rule it
# claims refuses a broken copy -- against a baseline it first proves clean, so no mutant can pass vacuously.
# launch-coverage derives the counts; the numbers in the plan are seeds this suite pins.
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT() { printf '%s' "$ARC_ROOT/.claude/scripts/launch/launch-lint.mjs"; }
COV() { printf '%s' "$ARC_ROOT/.claude/scripts/launch/launch-coverage.mjs"; }

@test "launch-lint: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "launch-lint: the real catalog and registry pass, and the pass names what it read" {
  run node "$(LINT)"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"launch-lint: ok -- 85 slots, "*" provider rows, "*" candidate-unbuilt"* ]] || { echo "$output"; false; }
}

@test "launch-lint: mutant self-test refuses all 13 mutants after a clean baseline" {
  run node "$(LINT)" --mutant-selftest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN baseline clean"* ]] || { echo "$output"; false; }
  local m
  for m in row-without-adapter adapter-without-row unknown-slot slot-names-provider vetted-by approved-by yaml \
           dag-cycle core-to-noncore edge-unresolved default-word zero-dep-leg verify-is-probe; do
    [[ "$output" == *"RAN mutant $m"* ]] || { echo "mutant $m never ran"; echo "$output"; false; }
    [[ "$output" == *"REFUSED $m"* ]] || { echo "mutant $m was not refused"; echo "$output"; false; }
  done
  [[ "$output" == *"13/13 mutants refused"* ]] || { echo "$output"; false; }
}

@test "launch-lint: a missing registry is a named refusal, never a clean pass" {
  run node "$(LINT)" --registry "$BATS_TEST_TMPDIR/absent.yaml"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL [missing] registry"* ]] || { echo "$output"; false; }
}

@test "launch-lint: an empty provider list fails from birth" {
  printf 'providers:\n' > "$BATS_TEST_TMPDIR/empty.yaml"
  run node "$(LINT)" --registry "$BATS_TEST_TMPDIR/empty.yaml"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL [shape]"* || "$output" == *"FAIL [empty]"* ]] || { echo "$output"; false; }
}

@test "launch-lint: a provider row that redefines a slot's exit criteria is refused" {
  cp "$ARC_ROOT/products/launch/launch.providers.yaml" "$BATS_TEST_TMPDIR/r.yaml"
  printf '  - id: rogue\n    slot: dns\n    status: candidate\n    exit_criteria:\n      - "whatever I say"\n    hosts:\n      - api.cloudflare.com\n    adapter: providers/dns/rogue.mjs\n    approved_by: ashiq\n' >> "$BATS_TEST_TMPDIR/r.yaml"
  run node "$(LINT)" --registry "$BATS_TEST_TMPDIR/r.yaml"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL [row-redefines-exit] rogue"* ]] || { echo "$output"; false; }
}

@test "launch-lint: a predicate outside the grammar is refused, not read as true or false" {
  sed 's/required_when: "tenancy == multi"/required_when: "tenancy is multi"/' "$ARC_ROOT/products/launch/launch.slots.yaml" > "$BATS_TEST_TMPDIR/s.yaml"
  ! cmp -s "$ARC_ROOT/products/launch/launch.slots.yaml" "$BATS_TEST_TMPDIR/s.yaml" || { echo "fixture edit did not land"; false; }
  run node "$(LINT)" --catalog "$BATS_TEST_TMPDIR/s.yaml"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL [predicate] tenancy"* ]] || { echo "$output"; false; }
}

@test "launch-coverage: derives 85 slots as 33 core, 35 required, 17 optional" {
  run node "$(COV)"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"85 slots (33 core · 35 required · 17 optional)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"core slots with a row 33/33"* ]] || { echo "$output"; false; }
}

@test "launch-coverage: --require-core-vetted fails while any core slot has zero vetted providers" {
  run node "$(COV)" --require-core-vetted
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL -- core slots with zero vetted providers: "*"dns"* ]] || { echo "$output"; false; }
}
