#!/usr/bin/env bats
# legal Phase 01 -- answerability (ADR-1209 / LEG-I).
#
# This suite exists for one reason: every OTHER check in this lane fails for rule-breaking, and a
# gate whose only failure mode is rule-breaking cannot report that a page is simply not good
# enough. `arc-design-cycle3` 2026-07-30 shipped exactly that -- PASS defined as an absence, so
# compliant characterless work passed five consecutive runs.
#
# So the assertions here are in two halves, and BOTH are required. The clean half proves the six
# fixtures answer every applicable question. The mutant half proves the check can still say no.
# Only the second half has ever been load-bearing.
bats_require_minimum_version 1.5.0
load 'test_helper'

CLI() { echo "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs"; }
SCENARIOS() { echo "$ARC_ROOT/products/legal/data/scenarios.json"; }

teardown() { _arc_legal_teardown; }

@test "legal scenarios: the fixture set is the committed one, at or above the ADR floor" {
  # ADR-1209 says "at least eight". Read from the file, so deleting rows down to seven fails here
  # rather than quietly lowering the bar the rest of the suite is measured against.
  run node "$ARC_ROOT/tests/legal-probe.mjs" scenario-count "$(SCENARIOS)"
  [ "$status" -eq 0 ]
  [ "$output" -ge 8 ]
}

@test "legal scenarios: every scenario names a page the pinned set actually renders" {
  run node "$ARC_ROOT/tests/legal-probe.mjs" scenario-pages "$(SCENARIOS)"
  [ "$status" -eq 0 ]
  run node "$(CLI)" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" ls-pages "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ]
  # Positive control: the render really produced the seven pages, so an empty page list cannot
  # make the containment below vacuously true.
  [ "$output" = "about.mdx contact.mdx pricing.mdx privacy.mdx refund-cancellation.mdx shipping-delivery.mdx terms.mdx" ]
}

@test "legal scenarios: all six ventures answer every scenario applicable to them" {
  # The clean half. On its own this proves nothing -- a lint that never fires passes this too --
  # which is why every mutant below exists.
  for v in fixture-gateway-gst fixture-gateway-nogst fixture-mor-gst fixture-mor-nogst fixture-none-gst fixture-none-nogst; do
    run node "$(CLI)" render --venture "$v" --out "$BATS_TEST_TMPDIR/out-$v"
    [ "$status" -eq 0 ]
    # Assert it RAN before asserting what it printed: exit 0 is the default exitCode, so a module
    # that loaded and never reached main() produces it too.
    [[ "$output" == *"rendered "*" page(s) for "* ]]
    run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$BATS_TEST_TMPDIR/out-$v/_run.json" completeness FAIL
    [ "$status" -eq 0 ]
    [ "$output" = "0" ]
  done
}

@test "legal scenarios: a template edit that ORPHANS a scenario turns completeness red" {
  # The case ADR-1209 names outright. The clause is RENAMED, not deleted, and the required-clause
  # list is renamed with it -- so the mandatory-clause check stays satisfied and the page still
  # renders a clause in that position. Everything provenance-shaped still passes. The only thing
  # that changed is that the reader's question has nowhere to be answered.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" orphan-scenario
  [ "$status" -eq 0 ]

  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ -f "$SANDBOX/out/_run.json" ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" completeness FAIL
  [ "$status" -eq 0 ]
  [ "$output" -gt 0 ]

  run node "$ARC_ROOT/tests/legal-probe.mjs" finding-clauses "$SANDBOX/out/_run.json" completeness FAIL
  [[ "$output" == *"SCN.NOTICE.LANGUAGE"* ]]
}

@test "legal scenarios: a MALFORMED scenario guard fails, it does not excuse the scenario" {
  # The fail-open class, on its second path. Row 11 of the fixed-defect list is exactly this bug
  # in the clause path: a one-character typo in a `when` field name silently disabled a mandatory
  # check. The rule is "grep the pattern, not the file" -- so the same failure mode is pinned
  # here, on the code that was written after the lesson.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" scenario-guard-typo
  [ "$status" -eq 0 ]

  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ -f "$SANDBOX/out/_run.json" ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" completeness FAIL
  [ "$status" -eq 0 ]
  [ "$output" -gt 0 ]

  run node "$ARC_ROOT/tests/legal-probe.mjs" finding-clauses "$SANDBOX/out/_run.json" completeness FAIL
  [[ "$output" == *"SCN.REFUND.WINDOW.GATEWAY"* ]]
}

@test "legal scenarios: a scenario aimed at a page that does not render is caught by the SET check" {
  # The per-page pass cannot see this one: the loop that would catch it never runs for a page that
  # does not exist, so the check would be disabled by exactly the condition it detects. Only the
  # once-per-run set-level pass can find it, and this is the test that proves that pass is wired.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" scenario-orphan-page
  [ "$status" -eq 0 ]

  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ -f "$SANDBOX/out/_run.json" ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" completeness FAIL
  [ "$status" -eq 0 ]
  [ "$output" -gt 0 ]
}

@test "legal scenarios: MISSING and UNANSWERED are two classes, and one mutant fires both" {
  # Guarding a mandatory clause off leaves the page provenance-clean, missing a required id, AND
  # missing the answer to the question that id was carrying. Both classes must appear, from one
  # mutation -- if only the MISSING id came back, the answerability half would be decorative.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" drop-required-clause
  [ "$status" -eq 0 ]

  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ -f "$SANDBOX/out/_run.json" ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" finding-clauses "$SANDBOX/out/_run.json" completeness FAIL
  [ "$status" -eq 0 ]
  [[ "$output" == *"PRIVACY.GRIEVANCE"* ]]   # MISSING: the mandatory clause id
  [[ "$output" == *"SCN.GRIEVANCE"* ]]       # UNANSWERED: the question it was answering
}

@test "legal scenarios: the unmutated sandbox is green, so every mutant above can fail" {
  # A control for the controls. Without it, each mutant assertion could be passing because the
  # SANDBOX is broken rather than because the mutation was caught.
  _arc_legal_sandbox
  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ "$status" -eq 0 ]
  [[ "$output" == *"rendered "*" page(s) for "* ]]
  run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" completeness FAIL
  [ "$output" = "0" ]
}

@test "legal scenarios: a scenario set with no rows is a refusal, never a quiet skip" {
  # A gate that cannot load its own pass condition must not report a clean run. This is the
  # emptiest possible answerability check, and it has to be louder than a passing one.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" write "$SANDBOX/products/legal/data/scenarios.json" '{"version":1,"scenarios":[]}'
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out" >/dev/null 2>"$SANDBOX/err.txt" || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 3 ]
  run cat "$SANDBOX/err.txt"
  [[ "$output" == *"scenarios.json"* ]]
}

@test "legal scenarios: this suite registers every test it declares" {
  command -v bats >/dev/null 2>&1 || { echo "bats is not on PATH" >&2; return 1; }
  run node "$ARC_ROOT/tests/legal-probe.mjs" count-tests "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  local declared="$output"
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$declared" -eq "$output" ]
}

@test "legal scenarios: every test name in this suite is 7-bit ASCII" {
  run _arc_ascii_test_names "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
}
