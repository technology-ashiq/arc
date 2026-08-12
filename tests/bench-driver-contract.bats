#!/usr/bin/env bats
# Phase 00 slice 01 -- drivers/mock, the replay driver bench's own tests run against.
#
# WHY A NAMED DRIVER AND NOT ARC_DRIVER_FAKE: the env fake cannot be selected with --driver
# and so cannot be named in a provenance record, and it short-circuits the real code path
# (common.mjs:180-191 returns before produce() runs). Slice 02 adds the negative control that
# proves mock does NOT do that; this file proves mock satisfies ADR-0203 in the first place.
#
# EVERY test here runs at zero cost and touches no provider: mock replays pinned bytes.
bats_require_minimum_version 1.5.0
load 'test_helper'

MOCKSH() { echo "$ARC_ROOT/.claude/scripts/engine/drivers/mock.sh"; }
RUN()    { echo "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"; }

# The spine writer honours ARC_SPINE_ROOT by PRESENCE, not truthiness (spine-io.mjs:41), so a
# throwaway root here can never append to the real event log.
setup() {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT"
  export ARC_MOCK_DIR="$ARC_ROOT/tests/fixtures/bench/mock-replay"
}

@test "mock satisfies the ADR-0203 driver contract on a recorded process" {
  run bash "$(MOCKSH)" run commit-msg-draft '{}' ''
  [ "$status" -eq 0 ]
  # stdout is the output JSON document and nothing else -- arc-run judges it, the driver does not.
  echo "$output" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);if(!Array.isArray(o.commits))process.exit(9);})"
}

@test "mock exits 1 and names the path when its recording is missing" {
  export ARC_MOCK_DIR="$BATS_TEST_TMPDIR/empty-replay"
  mkdir -p "$ARC_MOCK_DIR"
  run bash "$(MOCKSH)" run commit-msg-draft '{}' ''
  # Exit 1 is ADR-0203's driver-failure code. A silent empty response here would make an
  # unreachable fixture look like a passing one, which is the whole failure this guards.
  [ "$status" -eq 1 ]
  [[ "$output" == *"commit-msg-draft"* ]]
}

@test "arc-run routes --driver mock" {
  run node "$(RUN)" --process commit-msg-draft --driver mock --budget inr=10
  # The contract is that the driver is REACHED and produces a schema-valid document. arc-run
  # owns the verdict; this asserts the routing, not the score.
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# slice 02 -- the negative control: mock swaps the RESPONSE, never the code path.
#
# No file is patched and no tree is copied to prove this. `sed -i` is a GNU-ism that BSD sed
# reads as a backup suffix and it has already killed the macOS leg once (retro-log 2026-08-03),
# and a copied tree proves things about the copy. Instead the two paths are DISCRIMINATED by
# observable behaviour on the real files: mock reaches produce(), the env fake does not.
# ---------------------------------------------------------------------------

@test "mock runs the shared budget path, so an unparseable budget fails before any replay" {
  # parseBudget (common.mjs:33-42) runs inside runDriver AHEAD of produce(). If mock had
  # bypassed the shared path, this would sail through and the recording would be replayed.
  #
  # The segment must be unparseable, not merely unknown: parseBudget accepts ANY lowercase key
  # (`/^([a-z]+)=(\d+(?:\.\d+)?)$/`), so `foo=1` is valid here. The closed inr/min key set is
  # enforced a layer up in arc-run.mjs:128, never in the driver -- a distinction worth pinning,
  # because a test asserting `foo=1` fails would have been asserting a rule that lives elsewhere.
  run bash "$(MOCKSH)" run commit-msg-draft '{}' 'inr=abc'
  [ "$status" -eq 1 ]
  [[ "$output" == *"budget"* ]]
}

@test "mock reaches produce: an empty recording dir fails the run" {
  # The only code that can raise this is inside mock's produce(). Reaching it IS the claim.
  export ARC_MOCK_DIR="$BATS_TEST_TMPDIR/none"
  mkdir -p "$ARC_MOCK_DIR"
  run bash "$(MOCKSH)" run commit-msg-draft '{}' ''
  [ "$status" -eq 1 ]
  [[ "$output" == *"no recording"* ]]
}

@test "ARC_DRIVER_FAKE does NOT reach produce -- the engine defect this driver exists to avoid" {
  # Same empty recording dir as the test above, which alone makes mock exit 1. Adding the env
  # fake flips it to exit 0: common.mjs:180-191 returns before `await produce()` ever runs, so
  # produce is never consulted. That is why "every driver satisfies the same contract" is
  # vacuous for all three drivers today (retro-log 2026-08-03, still open).
  #
  # This is a CANARY, not an endorsement. Bench reports the defect and does not fix it -- the
  # repair is engine's. If engine fixes it, this test goes red and that red is the good news:
  # it means the fake stopped short-circuiting, and this canary should then be deleted.
  export ARC_MOCK_DIR="$BATS_TEST_TMPDIR/none2"
  mkdir -p "$ARC_MOCK_DIR"
  export ARC_DRIVER_FAKE="$ARC_ROOT/tests/fixtures/engine/driver-fakes/good"
  run bash "$(MOCKSH)" run commit-msg-draft '{}' ''
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# slice 03 -- the `version` verb, on claude-code and mock ONLY (ADR-0902).
#
# BEN-B makes "driver name + version" a mandatory provenance field, and no driver answers it
# today: common.mjs:152 rejects every verb but `run`. codex and generic-api are deliberately
# out of scope -- neither is installed or credentialed, so neither produces a receipt this
# cycle, and adding the verb to two unreachable drivers would only widen bench's diff on a
# tree it does not own.
# ---------------------------------------------------------------------------

@test "mock answers the version verb with its recording-dir identity" {
  run bash "$(MOCKSH)" version
  [ "$status" -eq 0 ]
  # mock@<sha> so a replay run can never be read as a provider run.
  [[ "$output" == mock@* ]]
}

@test "mock version changes when the recordings change" {
  run bash "$(MOCKSH)" version
  local first="$output"
  export ARC_MOCK_DIR="$BATS_TEST_TMPDIR/other"
  mkdir -p "$ARC_MOCK_DIR/commit-msg-draft"
  printf '{"commits":[]}\n' > "$ARC_MOCK_DIR/commit-msg-draft/default.json"
  run bash "$(MOCKSH)" version
  [ "$status" -eq 0 ]
  # A version that never moves is a constant wearing a version's label -- it would let a
  # changed recording set ride an unchanged provenance field.
  [ "$output" != "$first" ]
}

@test "claude-code answers the version verb" {
  run bash "$ARC_ROOT/.claude/scripts/engine/drivers/claude-code.sh" version
  [ "$status" -eq 0 ]
  [[ "$output" == claude-code@* ]]
}

@test "codex and generic-api still reject every verb but run" {
  # Out of scope by ADR-0902, and asserted so that "we added it everywhere" cannot happen by
  # drift. The usage message is the shared refusal from common.mjs:152.
  for d in codex generic-api; do
    run bash "$ARC_ROOT/.claude/scripts/engine/drivers/$d.sh" version
    [ "$status" -eq 1 ]
    [[ "$output" == *"usage:"* ]]
  done
}

@test "this file registers the number of tests it declares" {
  # retro-log 2026-08-04: bats SILENTLY DROPS a @test whose name carries a non-ASCII character.
  # Five such tests never ran, never failed, and the file was green. A suite running fewer tests
  # than it declares is indistinguishable from a suite that passes, so it asserts its own count.
  [ "${#BATS_TEST_NAMES[@]}" -eq 11 ]
}
