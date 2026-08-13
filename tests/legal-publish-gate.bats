#!/usr/bin/env bats
# legal Phase 01 -- REQ-06, the permanent human gate.
#
# REQ-06 says no legal page is ever published without a human decision. FOUR specs repeat that
# sentence, and until this suite existed nothing tested it -- the phase spec says so in as many
# words: "until this lands, that permanence is a sentence four specs repeat and nothing tests."
#
# The mechanism is `hq.policy.yaml`'s `targets.publish`, an EMPTY closed enum. Empty means no
# automated publish is addressable at all, which is a stronger property than "publishing is
# discouraged". This suite is the thing that keeps it empty.
#
# NOTE ON WHERE IT RUNS: the gate should also be its own CI step. `.github/` is write-denied in
# this workspace, so it could not be added, and running it from here is the honest second-best --
# these tests execute on every CI leg inside the bats step, so a publish target still turns the
# build red. What is lost is the clearer failure label, not the coverage.
bats_require_minimum_version 1.5.0
load 'test_helper'

teardown() { _arc_legal_teardown; }

@test "legal publish gate: the real repo policy has an empty publish target" {
  # Not a sandbox. This asserts the property on the tree being built, which is the point of the
  # gate -- every other test here proves it can fail; this one is the gate actually gating.
  run node "$ARC_ROOT/.claude/scripts/legal/publish-gate.mjs"
  [ "$status" -eq 0 ]
  [[ "$output" == *"REQ-06 human gate intact"* ]]
}

@test "legal publish gate: an INLINE publish target turns it red" {
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" publish-target-inline
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_PUBLISH_GATE" >"$SANDBOX/out.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/out.txt"
  [[ "$output" == *"REQ-06"* ]]
}

@test "legal publish gate: a BLOCK-LIST publish target turns it red" {
  # The shape a grep for `publish: []` would sail past, which is why the gate parses the key
  # instead of matching the line.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" publish-target-block
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_PUBLISH_GATE" >"$SANDBOX/out.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/out.txt"
  [[ "$output" == *"legal.publish"* ]]
}

@test "legal publish gate: DELETING the key is a failure, not a pass" {
  # The subtle one. An absent closed enum constrains nothing, so it is a WEAKER state than an
  # empty one -- and the naive implementation reads "no publish targets found" and exits 0.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" publish-key-deleted
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_PUBLISH_GATE" >"$SANDBOX/out.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/out.txt"
  [[ "$output" == *"not present"* ]]
}

@test "legal publish gate: the unmutated sandbox passes, so the mutants above can fail" {
  _arc_legal_sandbox
  run node "$ARC_LEGAL_PUBLISH_GATE"
  [ "$status" -eq 0 ]
  [[ "$output" == *"REQ-06 human gate intact"* ]]
}

@test "legal publish gate: a missing policy file exits 3, distinct from a violation" {
  # "Could not check" must never wear the same exit code as "checked and it is fine", and it
  # must not wear the same one as "checked and it is broken" either.
  _arc_legal_sandbox
  rm -f "$SANDBOX/hq.policy.yaml"
  MUTANT_STATUS=0
  node "$ARC_LEGAL_PUBLISH_GATE" >"$SANDBOX/out.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 3 ]
}

@test "legal publish gate: the engine still ships no publish verb at all" {
  # Belt and braces on the same non-negotiable from the other side: the policy could stay empty
  # while the CLI grew a publish path. Any verb but `render` must be refused.
  run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" publish --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 2 ]
  [ ! -f "$BATS_TEST_TMPDIR/out/terms.mdx" ]
}

@test "legal publish gate: this suite registers every test it declares" {
  command -v bats >/dev/null 2>&1 || { echo "bats is not on PATH" >&2; return 1; }
  run node "$ARC_ROOT/tests/legal-probe.mjs" count-tests "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  local declared="$output"
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$declared" -eq "$output" ]
}

@test "legal publish gate: every test name in this suite is 7-bit ASCII" {
  run _arc_ascii_test_names "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
}
