#!/usr/bin/env bats
# Governed fallback (ADR-0228, engine Cycle 8, REQ-08..11). The checks live in tests/engine-failure-class.mjs; each
# section here asserts its EXACT check count, so a check that silently stops registering turns this file red, and
# asserts zero FAIL lines. Local server and replay driver only -- no network, no key, no model.

load test_helper

PROBE() { echo "$ARC_ROOT/tests/engine-failure-class.mjs"; }

section_green() {
  local name="$1" count="$2"
  run node "$(PROBE)" "$name"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: $count checks, 0 failed"* ]] || { echo "expected exactly $count checks to run: $output"; false; }
  ! grep -q '^FAIL ' <<< "$output" || { echo "$output"; false; }
}

@test "failure-class unit: the six classes, the classifier, families, nextHop, terms and the real router" {
  section_green unit 54
  [[ "$output" == *"ok U: arc-run's loop asks nextHop exactly once and keeps no hop rule of its own"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok U: (c) nextHop over the same recorded hops is identical twice and mutates nothing"* ]] || { echo "$output"; false; }
}

@test "failure-class invariants a b c d hold through the real arc-run" {
  section_green inv 20
  [[ "$output" == *"ok (a) a transport failure reaches the second driver (count 1) and the run succeeds there"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok (b) a policy-refusal never reaches the second driver (count 0)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok (d) an undeclared failure is unknown and does not fall back (count 0)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok (c) max_attempts 1 refuses the hop before the second driver starts (count 0), receipted as budget"* ]] || { echo "$output"; false; }
}

@test "failure-class mutants: each of five mutants turns a named invariant red" {
  section_green mut 13
  for m in "m1 everything hops" "m2 budget hops" "m3 transport stops" "m4 model-invalid hops within one family" "m5 a declaration overrides the observed class"; do
    [[ "$output" == *"ok mutant $m: turns the"* ]] || { echo "mutant not killed: $m -- $output"; false; }
  done
}

@test "failure-class drivers: generic-api per HTTP status, and the CLI drivers with no CLI installed" {
  section_green drv 13
  [[ "$output" == *"ok D: generic-api HTTP 429 (money) declares budget and does not hop"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok D: claude-code with no CLI installed declares provider-unavailable"* ]] || { echo "$output"; false; }
}

@test "failure-class suite registers all of its tests" {
  # bats drops a @test whose name carries a non-ASCII character without a word; this file proves a rule, so it
  # counts itself (.claude/rules/testing.md, the test that was never there).
  run grep -c '^@test ' "$BATS_TEST_FILENAME"
  [ "$output" -eq 5 ]
}
