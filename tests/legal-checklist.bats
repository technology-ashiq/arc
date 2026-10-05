#!/usr/bin/env bats
# legal Phase 02 -- the launch checklist.
#
# This suite exists because an adversarial pass found the checklist had ZERO tests: the whole
# Phase-02 deliverable, including its four-outcome enumeration, its ADR-1201 row counts and its
# blank-row guard, could have been deleted body by body and the suite would have stayed green.
#
# The outcome enumeration is the point of the thing. `arc-memory` 2026-08-12 shipped a scanner
# that could not tell SCANNED CLEAN from COULD NOT SCAN, and NOT-CHECKED is the answer that keeps
# those apart here.
bats_require_minimum_version 1.5.0
load 'test_helper'

CLI() { echo "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs"; }

teardown() { _arc_legal_teardown; }

@test "legal checklist: a merchant venture renders 7 rows, all NOT-CHECKED by default" {
  # NOT-CHECKED is the honest default, not an error: every row is manual in v1 because the probe
  # arm was cut at kickoff, so nothing is known until a human records it.
  run node "$(CLI)" checklist --venture "fixture-gateway-gst"
  [ "$status" -eq 0 ]
  [[ "$output" == *"7 row(s): 0 PASS "* ]]
  [[ "$output" == *"7 NOT-CHECKED"* ]]
  [[ "$output" == *"PROV.TERMS"* ]]
  [[ "$output" == *"razorpay.com"* ]]
}

@test "legal checklist: a non-merchant venture renders NOT-APPLICABLE with a reason, never green" {
  # ADR-1211. Rendering these as PASS would tell an operator they had cleared a gate they were
  # never standing at.
  run node "$(CLI)" checklist --venture "fixture-none-nogst"
  [ "$status" -eq 0 ]
  [[ "$output" == *"7 NOT-APPLICABLE"* ]]
  [[ "$output" == *"no payments through a provider"* ]]
  [[ "$output" != *"0 NOT-APPLICABLE"* ]]
}

@test "legal checklist: an outcome outside the four is refused, not defaulted" {
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" write "$SANDBOX/ev.json" '{"PROV.TERMS":{"outcome":"MAYBE"}}'
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" checklist --venture "fixture-gateway-gst" --evidence "$SANDBOX/ev.json" \
    >"$SANDBOX/o.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/o.txt"
  [[ "$output" == *"MAYBE"* ]]
}

@test "legal checklist: NOT-APPLICABLE with no reason is refused" {
  # "It does not apply" without a reason is unfalsifiable, and it is the outcome an operator
  # reaches for to clear a row they have not actually done.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" write "$SANDBOX/ev.json" '{"PROV.TERMS":{"outcome":"NOT-APPLICABLE"}}'
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" checklist --venture "fixture-gateway-gst" --evidence "$SANDBOX/ev.json" \
    >"$SANDBOX/o.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/o.txt"
  [[ "$output" == *"no reason"* ]]
}

@test "legal checklist: a note carrying a table delimiter cannot rewrite the outcome column" {
  # An operator-supplied note lands in a markdown cell. A `|` in it rewrote the columns to its
  # right, so the rendered row's outcome said NOT-APPLICABLE while the object said PASS -- and
  # the blank-row guard could not see it, because that guard inspects the OBJECT.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" write "$SANDBOX/ev.json" '{"PROV.TERMS":{"outcome":"PASS","note":"saw it | **NOT-APPLICABLE** | not needed |"}}'
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" checklist --venture "fixture-gateway-gst" --evidence "$SANDBOX/ev.json" \
    >"$SANDBOX/o.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/o.txt"
  [[ "$output" == *"table delimiter"* ]]
}

@test "legal checklist: an ordinary note with served evidence is a PASS, so the refusals mean something" {
  _arc_legal_sandbox
  ARC_LEGAL_CLI="$ARC_LEGAL_CLI" _arc_legal_render "fixture-gateway-gst" >/dev/null
  run node "$ARC_ROOT/tests/legal-probe.mjs" served-evidence "$ARC_LEGAL_OUT" terms PROV.TERMS "$SANDBOX/ev.json"
  [ "$status" -eq 0 ]
  run node "$ARC_LEGAL_CLI" checklist --venture "fixture-gateway-gst" --evidence "$SANDBOX/ev.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"1 PASS"* ]]
  [[ "$output" == *"6 NOT-CHECKED"* ]]
  [[ "$output" == *"self-attested, not fetched"* ]]
}

@test "legal checklist: a PASS on status alone is refused -- it must carry what was served" {
  # A 200 passes a placeholder, a soft-404 and a homepage redirect alike, so a reachability PASS
  # without an excerpt of the served body and the page hash it matched is not evidence.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" write "$SANDBOX/ev.json" '{"PROV.TERMS":{"outcome":"PASS","note":"200 OK"}}'
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" checklist --venture "fixture-gateway-gst" --evidence "$SANDBOX/ev.json" \
    >"$SANDBOX/o.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/o.txt"
  [[ "$output" == *"served_excerpt"* ]]
}

@test "legal checklist: a served body that is not the page turns the PASS into a FAIL" {
  _arc_legal_sandbox
  ARC_LEGAL_CLI="$ARC_LEGAL_CLI" _arc_legal_render "fixture-gateway-gst" >/dev/null
  run node "$ARC_ROOT/tests/legal-probe.mjs" served-evidence "$ARC_LEGAL_OUT" terms PROV.TERMS "$SANDBOX/ev.json" placeholder
  [ "$status" -eq 0 ]
  run node "$ARC_LEGAL_CLI" checklist --venture "fixture-gateway-gst" --evidence "$SANDBOX/ev.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"0 PASS · 1 FAIL"* ]]
  [[ "$output" == *"placeholder, a soft-404 or a redirect"* ]]
}

@test "legal checklist: evidence matched against an older page version is a FAIL" {
  _arc_legal_sandbox
  ARC_LEGAL_CLI="$ARC_LEGAL_CLI" _arc_legal_render "fixture-gateway-gst" >/dev/null
  run node "$ARC_ROOT/tests/legal-probe.mjs" served-evidence "$ARC_LEGAL_OUT" terms PROV.TERMS "$SANDBOX/ev.json" stale
  [ "$status" -eq 0 ]
  run node "$ARC_LEGAL_CLI" checklist --venture "fixture-gateway-gst" --evidence "$SANDBOX/ev.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"1 FAIL"* ]]
  [[ "$output" == *"Re-check the live URL"* ]]
}

@test "legal checklist: a row with no source_url FAILS rather than rendering" {
  # A checklist telling an operator "the provider requires this" is a legal assertion, and an
  # assertion with no evidence link is what this product exists not to print.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" data-edit "$SANDBOX" provider-pages.json '"source_url": "https://razorpay.com/docs/payments/account-activation/"' '"unsourced": true'
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" checklist --venture "fixture-gateway-gst" >"$SANDBOX/o.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/o.txt"
  [[ "$output" == *"source_url"* ]]
}

@test "legal checklist: a row with no page FAILS, so served evidence cannot be skipped" {
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" data-edit "$SANDBOX" provider-pages.json '"page": "terms",' '"pagex": "terms",'
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" checklist --venture "fixture-gateway-gst" >"$SANDBOX/o.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/o.txt"
  [[ "$output" == *"or a page"* ]]
}

@test "legal checklist: the ADR-1201 row counts are asserted, so a dropped row is an error" {
  # 5 provider-required and 2 provider-conditional, pinned against a VERIFIED provider page-list.
  # A row silently dropped would otherwise just make the checklist shorter.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" data-edit "$SANDBOX" provider-pages.json '"kind": "provider-required"' '"kind": "provider-conditional"'
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" checklist --venture "fixture-gateway-gst" >"$SANDBOX/o.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/o.txt"
  [[ "$output" == *"ADR-1201"* ]]
}

@test "legal checklist: this suite registers every test it declares" {
  command -v bats >/dev/null 2>&1 || { echo "bats is not on PATH" >&2; return 1; }
  run node "$ARC_ROOT/tests/legal-probe.mjs" count-tests "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  local declared="$output"
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$declared" -eq "$output" ]
}

@test "legal checklist: every test name in this suite is 7-bit ASCII" {
  run _arc_ascii_test_names "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
}
