#!/usr/bin/env bats
# Phase 06, REQ-02 fixtures 2 and 3 -- the data boundary is refused ABOVE the driver.
#
# The layer matters more than the check. A boundary enforced inside the driver has already handed
# the document to the runtime by the time it refuses, so these tests assert an arc-run exit 5 and
# never a driver exit -- and they assert the refusal happened BEFORE any driver process existed,
# which is the only property that makes the boundary worth having.
#
# Exit 5 is its own code because arc-run already overloads 1 for "cannot proceed". A boundary
# refusal indistinguishable from a parse error is a boundary no fixture can assert (ADR-0219).
bats_require_minimum_version 1.5.0
load 'test_helper'

RUN() { echo "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"; }
PROBE() { echo "$ARC_ROOT/tests/engine-data-boundary-probe.mjs"; }

# A process that exists, so the run reaches the boundary rather than dying on an unknown process.
PROC="commit-msg-draft"

@test "boundary: an internal-only input is refused with arc-run exit 5" {
  run node "$(RUN)" --process "$PROC" --driver mock \
    --input '{"classification":"internal-only","text":"x"}'
  [ "$status" -eq 5 ] || { echo "expected the boundary code 5, got $status: $output"; false; }
  [[ "$output" == *"internal-only"* ]] || { echo "the reason is not named: $output"; false; }
}

@test "boundary: the refusal happens BEFORE any driver process starts" {
  # The mock driver reads a recording and fails loudly when there is none. Pointing it at an
  # empty directory means that if the driver were reached AT ALL, the run would fail as a driver
  # error rather than as a boundary refusal. Exit 5 therefore proves the driver never ran --
  # which is the whole claim, and it is not provable by reading the code.
  local empty="$BATS_TEST_TMPDIR/no-recordings"
  mkdir -p "$empty"
  run env ARC_MOCK_DIR="$empty" node "$(RUN)" --process "$PROC" --driver mock \
    --input '{"classification":"internal-only"}'
  [ "$status" -eq 5 ] || { echo "expected 5, got $status: $output"; false; }
  [[ "$output" != *"no recording for"* ]] || { echo "the driver was reached before the boundary: $output"; false; }
}

@test "boundary: NEGATIVE CONTROL -- the same run WITHOUT the marker is not refused" {
  # Without this, a boundary that refuses everything passes every test above. The same empty
  # recording dir is used, so this run must fail at the DRIVER and not at the boundary.
  local empty="$BATS_TEST_TMPDIR/no-recordings"
  mkdir -p "$empty"
  run env ARC_MOCK_DIR="$empty" node "$(RUN)" --process "$PROC" --driver mock --input '{"text":"x"}'
  [ "$status" -ne 5 ] || { echo "a clean input was refused as internal-only: $output"; false; }
  [[ "$output" == *"no recording for"* ]] || { echo "expected to reach the driver, got: $output"; false; }
}

@test "boundary: a PLANTED token anywhere in the document is found" {
  # A real pack declares itself with a classification field. A planted marker is the case where
  # nobody declared anything and the string is simply present, several levels down.
  run node "$(RUN)" --process "$PROC" --driver mock \
    --input '{"a":{"b":[{"c":"see ARC-INTERNAL-ONLY for details"}]}}'
  [ "$status" -eq 5 ] || { echo "expected 5, got $status: $output"; false; }
  [[ "$output" == *"planted internal-only token"* ]] || { echo "wrong reason: $output"; false; }
  [[ "$output" == *"a.b[0].c"* ]] || { echo "the marker path is not reported: $output"; false; }
}

@test "boundary: prose that merely mentions the phrase is NOT refused" {
  # Matching loose text containing the words would be a false-positive generator, and a gate that
  # cries wolf is a gate that gets disabled. The classification FIELD and the PLANTED TOKEN are
  # both precise on purpose.
  local empty="$BATS_TEST_TMPDIR/no-recordings"
  mkdir -p "$empty"
  run env ARC_MOCK_DIR="$empty" node "$(RUN)" --process "$PROC" --driver mock \
    --input '{"note":"this is not internal-only material, it is public"}'
  [ "$status" -ne 5 ] || { echo "prose was read as a classification: $output"; false; }
}

@test "boundary: a scan that cannot COMPLETE refuses, rather than reporting clean" {
  # An unfinished scan that reports "no markers" is the same failure shape as a discarded grep
  # exit status: the caller cannot tell "clean" from "did not look", and the permissive reading
  # is the one that ships.
  run node "$(PROBE)" incomplete
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REFUSED_INCOMPLETE"* ]] || { echo "$output"; false; }
}

@test "boundary: fixture 3 -- the refusal names the hosted: cloud row it was routed to" {
  # Fixture 3 is the SAME refusal with the routing fact attached, not a second rule. Written as
  # its own check, the two would drift on the first change to either.
  run node "$(PROBE)" cloud
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"hosted: cloud"* ]] || { echo "the routing fact is not named: $output"; false; }
  [[ "$output" == *"off this machine"* ]] || { echo "$output"; false; }
}

@test "boundary: ONE confinement function -- arc-run has exactly one call site" {
  # REQ-06: one confinement function, every path through it, never two call sites that can drift.
  # Asserted structurally rather than trusted, because the second call site is always added by
  # someone who did not read this comment.
  cd "$ARC_ROOT"
  local n
  n="$(grep -c "boundaryRefusal(" .claude/scripts/engine/arc-run.mjs)"
  [ "$n" -eq 1 ] || { echo "arc-run calls boundaryRefusal $n times; there must be exactly one"; false; }
  grep -q "from \"./data-boundary.mjs\"" .claude/scripts/engine/arc-run.mjs \
    || { echo "arc-run does not import the confinement function"; false; }
}

@test "boundary: the refusal is a RECEIPT, not just an exit code" {
  # A boundary that stops a run and leaves no trace is indistinguishable from a run nobody
  # attempted. The emit is asserted structurally: arc-run must emit before it exits 5.
  cd "$ARC_ROOT"
  run node "$(PROBE)" receipt-shape
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"EMITS_BEFORE_EXIT"* ]] || { echo "$output"; false; }
}

@test "this file registers every test it declares" {
  local n
  n="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$n" -eq 10 ] || { echo "declared $n tests, expected 10 - a test was added or silently dropped"; false; }
}
