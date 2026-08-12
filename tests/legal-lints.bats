#!/usr/bin/env bats
# legal Phase 00 -- the three lints, each proven by a mutant that RUNS.
#
# A guard whose negative control is a grep has no negative control: arc-evolve 2026-08-04
# shipped a propose-only guard that a mutant module walked straight past. Every lint here is
# attacked by a patched copy of the engine or the data, executed, and asserted RED.
bats_require_minimum_version 1.5.0
load 'test_helper'

teardown() { _arc_legal_teardown; }

# Render the sandbox after N mutations and leave the sidecar at $SANDBOX/out/_run.json.
_mutate_and_render() {
  local venture="$1"; shift
  _arc_legal_sandbox
  for kind in "$@"; do
    node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" "$kind" >/dev/null || return 1
  done
  node "$ARC_LEGAL_CLI" render --venture "$venture" --out "$SANDBOX/out" >/dev/null 2>"$SANDBOX/err.txt"
  MUTANT_STATUS=$?
  return 0
}

_fails() { node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" "$1" FAIL; }

@test "legal lints: a page with zero mandatory clauses fails completeness, not provenance" {
  # Every clause that IS present traces perfectly, because none is present. Provenance alone
  # cannot pass an empty page (retro-log 2026-07-30: PASS defined as an absence).
  run _mutate_and_render "fixture-gateway-gst" empty-page
  [ "$status" -eq 0 ]
  [ -f "$SANDBOX/out/_run.json" ]

  run _fails completeness
  [ "$status" -eq 0 ]
  [ "$output" -gt 0 ]

  run node "$ARC_ROOT/tests/legal-probe.mjs" finding-clauses "$SANDBOX/out/_run.json" completeness FAIL
  [[ "$output" == *"PRIVACY.GRIEVANCE"* ]]
}

@test "legal lints: a compliance claim in authored prose is caught in the rendered output" {
  run _mutate_and_render "fixture-gateway-gst" claim-in-template
  [ "$status" -eq 0 ]
  run _fails value
  [ "$status" -eq 0 ]
  [ "$output" -gt 0 ]
}

@test "legal lints: the denylist file is what catches the claim, not a hardcoded list" {
  # The pair is the proof. With the list, the claim is caught; with the list emptied, it is
  # not. Either half alone proves nothing: a clean page with an emptied list is green because
  # there was nothing to catch, which is how this control passed vacuously on its first run.
  run _mutate_and_render "fixture-gateway-gst" claim-in-template denylist-bypass
  [ "$status" -eq 0 ]
  run _fails value
  [ "$status" -eq 0 ]
  [ "$output" -eq 0 ]
}

@test "legal lints: a gateway-only clause rendered for a non-gateway venture is a branch mismatch" {
  # Observed from a venture that takes no gateway payments at all. Rendering the same mutant
  # against the gateway fixture is GREEN and correct -- a leak is only visible from the branch
  # that was not chosen, which is why the first version of this control could not fail.
  run _mutate_and_render "fixture-none-nogst" branch-leak
  [ "$status" -eq 0 ]
  run _fails trace
  [ "$status" -eq 0 ]
  [ "$output" -gt 0 ]

  run node "$ARC_ROOT/tests/legal-probe.mjs" finding-clauses "$SANDBOX/out/_run.json" trace FAIL
  [[ "$output" == *"REFUND.WINDOW"* ]]
}

@test "legal lints: the same leak is caught from the mor side too" {
  run _mutate_and_render "fixture-mor-gst" branch-leak
  [ "$status" -eq 0 ]
  run _fails trace
  [ "$output" -gt 0 ]
}

@test "legal lints: a clause-map that has drifted from the templates is a trace FAIL" {
  run _mutate_and_render "fixture-gateway-gst" map-drift
  [ "$status" -eq 0 ]
  run _fails trace
  [ "$status" -eq 0 ]
  [ "$output" -gt 0 ]
}

@test "legal lints: a mandatory clause dropped from the template is a completeness FAIL" {
  run _mutate_and_render "fixture-gateway-gst" drop-required-clause
  [ "$status" -eq 0 ]
  run _fails completeness
  [ "$status" -eq 0 ]
  [ "$output" -gt 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" finding-clauses "$SANDBOX/out/_run.json" completeness FAIL
  [[ "$output" == *"PRIVACY.GRIEVANCE"* ]]
}

@test "legal lints: a grievance window with no source_url refuses the whole render" {
  # This one is not a finding, it is a refusal: a legal number with no evidence link is the
  # exact thing this module exists to refuse, so it fails closed rather than warning.
  run _mutate_and_render "fixture-gateway-gst" strip-window-source
  [ "$status" -eq 0 ]
  [ "$MUTANT_STATUS" -eq 2 ]
  [ ! -f "$SANDBOX/out/_run.json" ]
  run cat "$SANDBOX/err.txt"
  [[ "$output" == *"source_url"* ]]
}

@test "legal lints: an unmutated sandbox is green, so every mutant above can fail" {
  _arc_legal_sandbox
  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" any FAIL
  [ "$output" = "0" ]
}

@test "legal lints: every fixture venture renders with zero FAIL findings" {
  for v in fixture-gateway-gst fixture-gateway-nogst fixture-mor-gst fixture-mor-nogst fixture-none-gst fixture-none-nogst; do
    run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" render --venture "$v" --out "$BATS_TEST_TMPDIR/o-$v"
    [ "$status" -eq 0 ]
    run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$BATS_TEST_TMPDIR/o-$v/_run.json" any FAIL
    [ "$status" -eq 0 ]
    [ "$output" = "0" ]
  done
}

@test "legal lints: the free-text run-of-spaces rule can actually match" {
  # Regression for a real defect in this lane: the rule was written /{2,}/, a quantifier with
  # nothing before it, which Annex B reads as the LITERAL text. It compiled, ran, and could
  # never fire. A rule that cannot fail is worse than a missing one.
  run node "$ARC_ROOT/tests/legal-schema-probe.mjs" freetext-double-space
  [ "$status" -eq 0 ]
  [ "$output" = "rejected" ]
}

@test "legal lints: a free-text value carrying a URL is rejected" {
  run node "$ARC_ROOT/tests/legal-schema-probe.mjs" freetext-url
  [ "$status" -eq 0 ]
  [ "$output" = "rejected" ]
}

@test "legal lints: a free-text value carrying markup is rejected" {
  run node "$ARC_ROOT/tests/legal-schema-probe.mjs" freetext-markup
  [ "$status" -eq 0 ]
  [ "$output" = "rejected" ]
}

@test "legal lints: an ordinary trade name is accepted" {
  # The negative control for the three rejections above: a rule set that rejects everything
  # would pass all of them and be useless.
  run node "$ARC_ROOT/tests/legal-schema-probe.mjs" freetext-ok
  [ "$status" -eq 0 ]
  [ "$output" = "accepted" ]
}

@test "legal lints: an empty sub_processors list on a data-holding venture is rejected" {
  run node "$ARC_ROOT/tests/legal-schema-probe.mjs" empty-subprocessors
  [ "$status" -eq 0 ]
  [ "$output" = "rejected" ]
}

@test "legal lints: an unknown top-level field is rejected rather than ignored" {
  run node "$ARC_ROOT/tests/legal-schema-probe.mjs" unknown-field
  [ "$status" -eq 0 ]
  [ "$output" = "rejected" ]
}

@test "legal lints: this suite registers every test it declares" {
  command -v bats >/dev/null 2>&1 || { echo "bats is not on PATH" >&2; return 1; }
  run node "$ARC_ROOT/tests/legal-probe.mjs" count-tests "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  local declared="$output"
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$declared" -eq "$output" ]
}

@test "legal lints: every test name in this suite is 7-bit ASCII" {
  run _arc_ascii_test_names "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
}
