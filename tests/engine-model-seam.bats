#!/usr/bin/env bats
# ADR-0220 -- the per-invocation model/root seam.
#
# WHAT THIS EXISTS TO PROVE. `arc-run` rebuilt the driver environment and overwrote both
# ARC_DRIVER_MODEL and ARC_ROOT unconditionally, so the only way to pin a model was a reviewed
# engine/router.yaml row -- and the one lane whose entire job is comparing models has no write
# path to that file, ever. The same overwrite meant no driver could be pointed at a materialized
# fixture repo, so `commit-msg-draft` (which holds git.op add:* and commit:*) would have staged
# and committed INSIDE the arc repo.
#
# WHAT THIS DELIBERATELY DOES NOT DO. It does not make a caller-set ARC_DRIVER_MODEL work. Reading
# that variable off the ambient environment is the un-reviewed tier change ADR-0069 b1 forbids, and
# is precisely why the overwrite was written. The seam is two EXPLICIT flags, so a trial is
# something a caller wrote down rather than something the environment leaked in.
#
# Every green arm below is paired with a negative control, because a seam that is only ever
# observed working is a seam nobody has seen fail.
bats_require_minimum_version 1.5.0
load 'test_helper'

RUN()  { echo "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"; }
FAKE() { echo "$ARC_ROOT/tests/fixtures/engine/driver-fakes/$1"; }

setup() { export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"; mkdir -p "$ARC_SPINE_ROOT"; }

# Reads the model + provenance off whichever day file the receipt actually landed in. It never
# computes a day: the spine names its files from an IST timestamp and deriving that a second time
# here is the exact defect this lane already shipped once.
_receipt_field() {
  grep -rhoE "\"$1\":\"[^\"]*\"" "$ARC_SPINE_ROOT/events" 2>/dev/null | tail -1
}

# ---------------------------------------------------------------------------
# The model half
# ---------------------------------------------------------------------------

@test "seam: with no flags the run is byte-identical to before - unpinned, source none" {
  # THE REGRESSION GUARD, and the most important test in the file. The seam widens what is
  # EXPRESSIBLE, not what happens by default. If this ever changes, every existing caller changed
  # underneath it without asking.
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_receipt_field model)" = '"model":"unpinned"' ] || { echo "got $(_receipt_field model)"; false; }
  [ "$(_receipt_field model_source)" = '"model_source":"none"' ] || { echo "got $(_receipt_field model_source)"; false; }
}

@test "seam: --trial-model reaches the receipt as a clean model id" {
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-model claude-opus-5 --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The MP-F seat is the model that RAN, not a tagged string. A reader must not have to parse it.
  [ "$(_receipt_field model)" = '"model":"claude-opus-5"' ] || { echo "got $(_receipt_field model)"; false; }
}

@test "seam: a trial is recorded as a trial, never as a routing decision" {
  # THE POINT OF THE PROVENANCE FIELD. A trial override that read back as a routed pin would
  # assert a routing decision nothing applied -- a false claim in an append-only ledger, which is
  # worse than an absent one, and is the same failure the tier label caused before it.
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-model claude-opus-5 --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [ "$(_receipt_field model_source)" = '"model_source":"trial"' ] || { echo "got $(_receipt_field model_source)"; false; }
}

@test "seam: NEGATIVE CONTROL a trial may not silently override a reviewed router pin" {
  # Two sources for one value is an operator error, not a precedence puzzle. Silently picking
  # either is how a trial gets recorded as production routing.
  run node "$(RUN)" --process commit-msg-draft --driver auto --trial-model claude-opus-5 --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"conflicts with the router pin"* ]] || { echo "$output"; false; }
}

@test "seam: NEGATIVE CONTROL a malformed model id is refused before the driver starts" {
  run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-model 'not a model!' --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status"; false; }
  [[ "$output" == *"not a clean model id"* ]] || { echo "$output"; false; }
  # It refused BEFORE spending a driver call: no receipt exists at all.
  [ -z "$(_receipt_field model)" ] || { echo "a run happened despite the refusal"; false; }
}

@test "seam: an ambient ARC_DRIVER_MODEL is still ignored - b1 stays closed" {
  # THE HOLE THAT MUST STAY SHUT. This is not a limitation to fix later; it is the decision.
  # Only the flag speaks.
  ARC_DRIVER_MODEL="smuggled-in-via-env" ARC_DRIVER_FAKE="$(FAKE good)" \
    run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_receipt_field model)" = '"model":"unpinned"' ] || { echo "an env var reached the model seat: $(_receipt_field model)"; false; }
}

# ---------------------------------------------------------------------------
# The workspace half
# ---------------------------------------------------------------------------

@test "seam: --work-root points the driver at another tree" {
  # The mock driver resolves its recordings from ARC_ROOT (mock.mjs:32). Copying them under a
  # work-root and passing NO ARC_MOCK_DIR means a successful replay can only happen if the flag
  # actually reached the driver's environment.
  w="$BATS_TEST_TMPDIR/work"
  mkdir -p "$w/tests/fixtures/bench"
  cp -r "$ARC_ROOT/tests/fixtures/bench/mock-replay" "$w/tests/fixtures/bench/"
  [ -d "$w/tests/fixtures/bench/mock-replay" ] || { echo "fixture copy failed, the test would prove nothing"; false; }

  run node "$(RUN)" --process commit-msg-draft --driver mock --work-root "$w" --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"commits"* ]] || { echo "no replayed document: $output"; false; }
}

@test "seam: NEGATIVE CONTROL an empty work-root makes the driver fail in THAT tree" {
  # Proves the positive above is not passing because arc-run quietly fell back to its own root.
  w="$BATS_TEST_TMPDIR/empty-work"
  mkdir -p "$w"
  run node "$(RUN)" --process commit-msg-draft --driver mock --work-root "$w" --root "$ARC_ROOT"
  [ "$status" -ne 0 ] || { echo "the driver found recordings it should not have: $output"; false; }
  # And it looked inside the work-root, not the arc repo -- the path is named in the error.
  [[ "$output" == *"empty-work"* ]] || { echo "the driver did not look in the work-root: $output"; false; }
}

@test "seam: NEGATIVE CONTROL a work-root that does not exist is refused" {
  run node "$(RUN)" --process commit-msg-draft --driver mock --work-root "$BATS_TEST_TMPDIR/nope" --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status"; false; }
  [[ "$output" == *"does not exist"* ]] || { echo "$output"; false; }
}

@test "seam: arc lives at --root even when the driver works elsewhere" {
  # The two roots must not have collapsed back into one. arc-run still resolves its OWN machinery
  # -- processes/, the driver scripts, the emitter -- from --root, which is why a work-root holding
  # no processes/ directory still runs.
  w="$BATS_TEST_TMPDIR/bare"
  mkdir -p "$w/tests/fixtures/bench"
  cp -r "$ARC_ROOT/tests/fixtures/bench/mock-replay" "$w/tests/fixtures/bench/"
  [ ! -d "$w/processes" ] || { echo "the work-root must NOT hold processes/ for this test to mean anything"; false; }

  run node "$(RUN)" --process commit-msg-draft --driver mock --work-root "$w" --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "arc-run failed to find its own machinery: $output"; false; }
}

# ---------------------------------------------------------------------------

@test "suite: all 11 tests in this file are REGISTERED, not merely declared" {
  # grep on the source counts DECLARED tests; a test bats drops leaves its line intact, so the
  # number never moves and the guard stays green while a test did not run. `bats --count` is what
  # bats actually registered. Assert both and that they agree.
  declared="$(grep -c "^@test " "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "11" ] || { echo "expected 11 REGISTERED, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but registered $registered -- a test was dropped"; false; }
}
