#!/usr/bin/env bats
# Metered runs (ADR-0229, ADR-0230, ADR-0231, engine Cycle 9, REQ-12..14). The checks live in tests/engine-spend.mjs;
# each section here asserts its EXACT check count, so a check that silently stops registering turns this file red, and
# asserts zero FAIL lines. Local server, mock replay and fake CLIs only -- no network, no key, no model.

load test_helper

PROBE() { echo "$ARC_ROOT/tests/engine-spend.mjs"; }

section_green() {
  local name="$1" count="$2"
  run node "$(PROBE)" "$name"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: $count checks, 0 failed"* ]] || { echo "expected exactly $count checks to run: $output"; false; }
  ! grep -q '^FAIL ' <<< "$output" || { echo "$output"; false; }
}

@test "spend unit: spendOf corpus, one rounding per run, the shape check, basis and the reverse trace" {
  section_green unit 38
  [[ "$output" == *"ok U: spendOf(0.07) is 7 cents, provider_amount 0.07"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok U: sumSpend of 0.004 + 0.004 is 1 cent with provider_amount 0.008 (ceil once, not 1 + 1)"* ]] || { echo "$output"; false; }
}

@test "spend run: one cost.incurred per metered run through the real arc-run, absences named, never 0" {
  section_green run 22
  [[ "$output" == *"ok R: exactly ONE cost.incurred, landed, naming its run.completed by run_ref"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok R: a provider that gives no figure leaves spend null, spend_absence not-reported, and ZERO money rows (control above: 1)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok R: costs.mjs (the Money room fold) shows a USD measured overhead line of 1 cent"* ]] || { echo "$output"; false; }
}

@test "spend suite registers all of its tests" {
  # bats drops a @test whose name carries a non-ASCII character without a word; this file proves a rule, so it
  # counts itself (.claude/rules/testing.md, the test that was never there).
  run grep -c '^@test ' "$BATS_TEST_FILENAME"
  [ "$output" -eq 3 ]
}
