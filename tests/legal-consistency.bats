#!/usr/bin/env bats
# legal Phase 01 -- cross-page consistency (ADR-1213).
#
# The existing three lints each read ONE page. Three reader panels, blind to each other, put a
# contradiction BETWEEN two pages in their top four findings -- pages that individually passed
# every lint this lane had. This suite's job is to prove the fourth group sees what the other
# three structurally cannot, and the mutant below is the whole argument: it must leave value,
# trace and completeness GREEN while turning consistency red. If it ever fires all four, this
# lint has stopped testing the thing it was built for.
bats_require_minimum_version 1.5.0
load 'test_helper'

CLI() { echo "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs"; }

teardown() { _arc_legal_teardown; }

@test "legal consistency: all six ventures are cross-page consistent" {
  for v in fixture-gateway-gst fixture-gateway-nogst fixture-mor-gst fixture-mor-nogst fixture-none-gst fixture-none-nogst; do
    run node "$(CLI)" render --venture "$v" --out "$BATS_TEST_TMPDIR/out-$v"
    [ "$status" -eq 0 ]
    # Assert it RAN before asserting what it printed.
    [[ "$output" == *"rendered "*" page(s) for "* ]]
    run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$BATS_TEST_TMPDIR/out-$v/_run.json" consistency FAIL
    [ "$status" -eq 0 ]
    [ "$output" = "0" ]
  done
}

@test "legal consistency: the vague-commitment mutant is caught by THIS lint and no other" {
  # The reader panels' actual finding, reproduced: the pricing page states the price-rise
  # commitment with the number taken out, while the terms page states it with the number. Nothing
  # disagrees numerically, because one side has no number -- and the vaguer page is the one a
  # buyer reads before paying.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" cross-page-drift
  [ "$status" -eq 0 ]

  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ -f "$SANDBOX/out/_run.json" ]

  run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" consistency FAIL
  [ "$status" -eq 0 ]
  [ "$output" -gt 0 ]

  # And the half that makes this a proof rather than an assertion: the OTHER three groups must
  # stay green. A mutant that trips everything would show only that the page is broken, not that
  # this lint sees something the others miss.
  for group in value trace completeness; do
    run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" "$group" FAIL
    [ "$status" -eq 0 ]
    [ "$output" = "0" ]
  done
}

@test "legal consistency: a claim anchored to an unset facts field FAILS, it does not skip" {
  # A cross-page check with nothing to compare passes every page and proves nothing, so it has to
  # be louder than a clean run rather than quieter.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" claim-anchor-missing
  [ "$status" -eq 0 ]

  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ -f "$SANDBOX/out/_run.json" ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" consistency FAIL
  [ "$status" -eq 0 ]
  [ "$output" -gt 0 ]
}

@test "legal consistency: the unmutated sandbox is green, so the mutants above can fail" {
  _arc_legal_sandbox
  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ "$status" -eq 0 ]
  [[ "$output" == *"rendered "*" page(s) for "* ]]
  run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" consistency FAIL
  [ "$output" = "0" ]
}

@test "legal consistency: the lint group set is derived, never pinned to a literal" {
  # ADR-1213 grew GROUPS from three to four. Anything that counted three is now wrong, and a
  # pinned literal here would go red for ADDING a fifth -- the arc-memory 2026-08-12 failure.
  run node "$ARC_ROOT/tests/legal-probe.mjs" groups
  [ "$status" -eq 0 ]
  [[ "$output" == *"consistency"* ]]
  run node "$(CLI)" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ]
  # Every declared group is a group the run actually reports on, so a group can never be declared
  # and silently never run.
  run node "$ARC_ROOT/tests/legal-probe.mjs" groups-reported "$BATS_TEST_TMPDIR/out/_run.json"
  [ "$status" -eq 0 ]
}

@test "legal consistency: this suite registers every test it declares" {
  command -v bats >/dev/null 2>&1 || { echo "bats is not on PATH" >&2; return 1; }
  run node "$ARC_ROOT/tests/legal-probe.mjs" count-tests "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  local declared="$output"
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$declared" -eq "$output" ]
}

@test "legal consistency: every test name in this suite is 7-bit ASCII" {
  run _arc_ascii_test_names "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
}
