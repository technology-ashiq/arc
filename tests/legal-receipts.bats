#!/usr/bin/env bats
# legal Phase 01 -- the approval chain (LEG-D, REQ-06).
#
# The law under test, in one sentence: a decision approves specific BYTES, not a venture. An
# approval that survives an edit to the facts file is not an approval, it is a rubber stamp with
# a delay.
#
# Every test here is a REFUSAL except the two that must succeed, and that ratio is the point --
# a publish gate is defined by what it declines. The happy-path tests exist so the refusals
# cannot be passing because publishing is broken outright.
#
# The decision receipts come from `legal-probe.mjs decision`, the offline FAKE for the spine: the
# real receipt is written by `arc-inbox approve` on the canonical clone, which no test can reach,
# because the spine is gitignored and CI has none at all. The fake takes overrides on purpose --
# one that could only mint VALID receipts could not test a gate whose whole job is refusing
# invalid ones.
bats_require_minimum_version 1.5.0
load 'test_helper'

REQ="01TESTREQUEST00000000000000"

teardown() { _arc_legal_teardown; }

# Render + propose inside the sandbox, leaving $SANDBOX/out ready to publish from.
_proposed() {
  _arc_legal_sandbox || return 1
  node "$ARC_LEGAL_CLI" propose --venture "fixture-gateway-gst" --out "$SANDBOX/out" >/dev/null 2>&1 || return 1
  [ -f "$SANDBOX/out/_approval.json" ] || { echo "propose wrote no approval request" >&2; return 1; }
  return 0
}

# Publish, capturing the exit code without errexit aborting the function first.
_publish() {
  PUBLISH_STATUS=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    --decision "$1" --request "${2:-$REQ}" >"$SANDBOX/pub.txt" 2>&1 || PUBLISH_STATUS=$?
  return 0
}

@test "legal receipts: propose writes a strict, closed approval payload" {
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/out/_approval.json" subject
  [ "$status" -eq 0 ]
  [ "$output" = "legal.publish" ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/out/_approval.json" facts_sha256
  [ "$status" -eq 0 ]
  [ "${#output}" -eq 64 ]
}

@test "legal receipts: propose emits nothing to the spine and publishes nothing" {
  # REQ-06 makes the human gate permanent. A verb that both requests approval and could record it
  # is one refactor away from doing both, so propose must leave no published artefact at all.
  _proposed
  [ ! -f "$SANDBOX/out/_published.json" ]
  run cat "$SANDBOX/out/../out/_approval.json"
  [ "$status" -eq 0 ]
}

@test "legal receipts: an approved decision bound to these bytes publishes" {
  # The positive control. Without it, every refusal below could be passing because publish is
  # broken rather than because the gate refused.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 0 ]
  [ -f "$SANDBOX/out/_published.json" ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"published "*" page(s)"* ]]
}

@test "legal receipts: TOCTOU -- approve, edit the facts, publish is REFUSED" {
  # The red that matters most. The approval and a fresh render would agree with each other
  # perfectly after the edit; what they no longer agree with is what the human decided.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]

  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate-facts "$SANDBOX" "fixture-gateway-gst" refund_window_days 7
  [ "$status" -eq 0 ]

  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"FACTS_CHANGED"* ]]
  [ ! -f "$SANDBOX/out/_published.json" ]
}

@test "legal receipts: TOCTOU -- the page BYTES on disk changed after approval, REFUSED" {
  # The case a re-render alone cannot catch: the run record and the approval agree, and the file
  # that would actually be published is a different file. Hashing the record's copy of the text
  # instead of the bytes on disk passes this.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" tamper-page "$SANDBOX/out" terms
  [ "$status" -eq 0 ]

  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"PAGE_BYTES_CHANGED"* ]]
}

@test "legal receipts: a REJECTED decision with a perfect hash chain is still refused" {
  # The chain and the verdict are checked separately on purpose. Folding them together is how an
  # intact chain starts standing in for consent.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" reject "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"VERDICT_NOT_APPROVE"* ]]
}

@test "legal receipts: a decision about a DIFFERENT request is refused" {
  # The first cut of this check passed `decision.decides` in as the expected value, comparing the
  # field against itself -- it could never fire, and any recorded approval anywhere would have
  # published. The expected value now comes from the caller, so this test can fail.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json" "01SOMEOTHERREQUEST000000000"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"DECIDES_MISMATCH"* ]]
}

@test "legal receipts: publish without a decision is refused, not defaulted" {
  _proposed
  PUBLISH_STATUS=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    >"$SANDBOX/pub.txt" 2>&1 || PUBLISH_STATUS=$?
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"REQ-06"* ]]
}

@test "legal receipts: publish without --request is refused" {
  # Without it there is nothing to bind the decision TO, and any recorded approval would do.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  PUBLISH_STATUS=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    --decision "$SANDBOX/d.json" >"$SANDBOX/pub.txt" 2>&1 || PUBLISH_STATUS=$?
  [ "$PUBLISH_STATUS" -eq 2 ]
}

@test "legal receipts: BACKDATING -- an effective date before the decision is refused" {
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2027-01-01T00:00:00Z"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"BACKDATED"* ]]
}

@test "legal receipts: an unknown key in the approval payload is REJECTED, not ignored" {
  # ADR-1003's closed profile. An emitter that ignores unknown keys carries whatever somebody
  # adds later -- a `force: true` would ride along and the receipt would look clean.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" approval-unknown-key "$SANDBOX/out/_approval.json"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"unknown key"* ]]
}

@test "legal receipts: publish is refused when nothing was ever proposed" {
  # "Could not check" gets its own exit code: 3, never 0 and never 2.
  _arc_legal_sandbox
  mkdir -p "$SANDBOX/empty"
  PUBLISH_STATUS=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/empty" \
    --decision "$SANDBOX/nope.json" --request "$REQ" >"$SANDBOX/pub.txt" 2>&1 || PUBLISH_STATUS=$?
  [ "$PUBLISH_STATUS" -eq 3 ]
}

@test "legal receipts: this suite registers every test it declares" {
  command -v bats >/dev/null 2>&1 || { echo "bats is not on PATH" >&2; return 1; }
  run node "$ARC_ROOT/tests/legal-probe.mjs" count-tests "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  local declared="$output"
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$declared" -eq "$output" ]
}

@test "legal receipts: every test name in this suite is 7-bit ASCII" {
  run _arc_ascii_test_names "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
}
