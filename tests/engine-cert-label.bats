#!/usr/bin/env bats
# Phase 06, REQ-02 -- the certification label is DERIVED, and a mock run cannot produce it.
#
# The spec is specific about the strength of this: "a mock-green run must be structurally
# incapable of producing a certification label", and "the label is asserted by a test rather than
# written by hand". So the tests here are not "does the function return the right string" -- they
# are "is there any input at all that gets certification out of a run that did not happen".
#
# The previous cycle closed with its central claim unproven because a label had been written by
# someone who believed it. This file exists so that cannot repeat silently.
bats_require_minimum_version 1.5.0
load 'test_helper'

PROBE() { echo "$ARC_ROOT/tests/engine-cert-label-probe.mjs"; }

@test "cert-label: a real run against the pinned runtime certifies" {
  run node "$(PROBE)" real
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CERTIFICATION"* ]] || { echo "$output"; false; }
}

@test "cert-label: the mock driver can NEVER certify, whatever else is true" {
  # Every other fact is the real one. Only the driver changes.
  run node "$(PROBE)" mock
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REGRESSION"* ]] || { echo "$output"; false; }
  [[ "$output" == *"not the real runtime"* ]] || { echo "the reason is not named: $output"; false; }
}

@test "cert-label: a tag instead of a digest cannot certify" {
  run node "$(PROBE)" tag
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REGRESSION"* ]] || { echo "$output"; false; }
  [[ "$output" == *"not pinned by digest"* ]] || { echo "$output"; false; }
}

@test "cert-label: a digest that is not the LOCKED one cannot certify" {
  # Digest-shaped is not the same fact as vetted.
  run node "$(PROBE)" wrong-digest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REGRESSION"* ]] || { echo "$output"; false; }
  [[ "$output" == *"not the one capability-lock.json records"* ]] || { echo "$output"; false; }
}

@test "cert-label: no docker daemon means no container-backed run happened" {
  run node "$(PROBE)" no-daemon
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REGRESSION"* ]] || { echo "$output"; false; }
}

@test "cert-label: a suite that ran ZERO fixtures certifies nothing" {
  # The most-repeated failure in this repository is a green suite that executed nothing.
  run node "$(PROBE)" zero-fixtures
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REGRESSION"* ]] || { echo "$output"; false; }
  [[ "$output" == *"runs nothing"* ]] || { echo "$output"; false; }
}

@test "cert-label: a FAILED certification is still a certification, not a regression" {
  # Recording a failed certification as a regression would hide exactly the result this phase
  # exists to surface. The label describes what KIND of run happened, never whether it passed.
  run node "$(PROBE)" real-but-failing
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CERTIFICATION"* ]] || { echo "a failing real run was downgraded: $output"; false; }
}

@test "cert-label: the label cannot be ASSERTED -- every assertion key is refused, not ignored" {
  # Ignoring an asserted label would let a caller believe it had said something. Refusing says so.
  run node "$(PROBE)" asserted
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ALL_REFUSED"* ]] || { echo "an assertion key was accepted: $output"; false; }
}

@test "cert-label: NEGATIVE CONTROL -- the probe reports a failure when one is present" {
  # Without this, every assertion above is satisfied by a probe that prints REGRESSION always.
  run node "$(PROBE)" self-check
  [ "$status" -eq 1 ] || { echo "the probe cannot fail, so it proves nothing: status=$status"; false; }
  [[ "$output" == *"CONTROL_FAILED_AS_DESIGNED"* ]] || { echo "$output"; false; }
}

@test "this file registers every test it declares" {
  # FIXED 2026-08-17 after an adversarial pass defeated the previous version, which counted
  # `^@test ` lines in the SOURCE -- the DECLARED count. bats silently DROPS a @test whose name
  # carries a non-ASCII character, and the source line survives the drop, so the number never
  # moved and the guard stayed green while a test did not run. `bats --count` reports what bats
  # actually REGISTERED. Assert both and that they agree: the pair catches a drop (registered
  # falls) and a silent removal (declared falls).
  declared="$(grep -c "^@test " "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "10" ] || { echo "expected 10 REGISTERED tests, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but bats registered $registered -- a test was silently dropped"; false; }
}
