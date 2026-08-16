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

@test "legal publish gate: five ATTACKER YAML shapes of a live publish target all refuse" {
  # These are the attacker's shapes, not the author's. The hand-rolled reader this gate started
  # with passed every one of them at exit 0, printing its success banner -- and caught only the
  # indented dash, which was the shape its OWN mutant used, because the mutants had been derived
  # from the implementation. `gate-author-cannot-be-its-attacker`, one commit after the gate.
  #
  # The assertion is "not 0", because these split legitimately between exit 2 (a target is there)
  # and exit 3 (the strict parser refuses the file outright: duplicate keys and tabs are outside
  # its subset). Both are safe; only 0 is not. Each shape is asserted separately so a single fix
  # cannot appear to cover all five.
  # The expected code is pinned PER SHAPE, not asserted as "not 0". Three of the five currently
  # refuse at 3 because the strict parser rejects the FILE (duplicate keys and tabs are outside
  # its subset) rather than because it saw a target -- and `same-indent` is the shape this gate's
  # own header calls the most idiomatic of all, the one the hand-rolled reader was bypassed by.
  # If the parser is ever relaxed to accept an idiomatic block sequence, that shape must start
  # refusing at 2 for the RIGHT reason, and a bare "not 0" would never notice the difference.
  local case_line
  for case_line in "publish-shape-decoy:2:legal.publish" \
                   "publish-shape-same-indent:3:did not parse" \
                   "publish-shape-duplicate-key:3:did not parse" \
                   "publish-shape-tab:3:did not parse" \
                   "publish-shape-no-value:2:empty-valued"; do
    shape="${case_line%%:*}"
    rest="${case_line#*:}"
    want="${rest%%:*}"
    msg="${rest##*:}"

    _arc_legal_sandbox
    run node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" "$shape"
    [ "$status" -eq 0 ]
    MUTANT_STATUS=0
    node "$ARC_LEGAL_PUBLISH_GATE" >"$SANDBOX/out.txt" 2>&1 || MUTANT_STATUS=$?
    [ "$MUTANT_STATUS" -eq "$want" ] || { echo "shape $shape exited $MUTANT_STATUS, wanted $want" >&2; false; }
    run cat "$SANDBOX/out.txt"
    [[ "$output" == *"$msg"* ]] || { echo "shape $shape refused for the wrong reason: $output" >&2; false; }
    _arc_legal_teardown
  done
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

@test "legal publish gate: publish refuses without a human decision, citing REQ-06" {
  # This test used to claim "the engine still ships no publish verb at all", which stopped being
  # true the moment `publish` was built -- and it passed for the wrong reason: it invoked publish
  # with `--out` instead of `--dir`, so the exit 2 it observed was an argument error. It would
  # have stayed green if publish published freely. Fixed-defect row 16, `test-asserts-the-wrong-law`,
  # on a second file.
  #
  # What IS non-negotiable is asserted instead: a well-formed publish with no decision refuses.
  run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" publish --venture "fixture-gateway-gst" --dir "$BATS_TEST_TMPDIR"
  [ "$status" -eq 2 ]
  [[ "$output" == *"REQ-06"* ]]
}

@test "legal publish gate: an unknown verb is refused rather than treated as render" {
  run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" deploy --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 2 ]
  [[ "$output" == *"unknown verb"* ]]
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
